import { createClient } from 'npm:@supabase/supabase-js@2';

const secretKeys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}');
const serviceKey = secretKeys.default as string | undefined;
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
if (!serviceKey || !supabaseUrl) throw new Error('Supabase service credentials are missing.');

const admin = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

let cachedPepper = '';
let cachedPinEncryptionKey: CryptoKey | null = null;
async function getPepper() {
  if (cachedPepper) return cachedPepper;
  const { data, error } = await admin
    .from('account_recovery_settings')
    .select('pepper')
    .eq('singleton', true)
    .single();
  if (error || !data?.pepper) throw new Error('Recovery signing key is unavailable.');
  cachedPepper = data.pepper;
  return cachedPepper;
}

async function getPinEncryptionKey() {
  if (cachedPinEncryptionKey) return cachedPinEncryptionKey;
  const secret = Deno.env.get('ACCOUNT_PASSWORD_ENCRYPTION_KEY') ?? '';
  if (!/^[0-9a-fA-F]{64}$/.test(secret)) throw new Error('Account password encryption key is unavailable.');
  const raw = Uint8Array.from(secret.match(/.{2}/g)!, (byte) => Number.parseInt(byte, 16));
  cachedPinEncryptionKey = await crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
  return cachedPinEncryptionKey;
}

function base64UrlEncode(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function base64UrlDecode(value: string) {
  const base64 = value.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - value.length % 4) % 4);
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
}

function pinAdditionalData(userId: string, publicUid: string) {
  return new TextEncoder().encode(`global-chat-account-password:v1:${userId}:${publicUid}`);
}

async function encryptPin(pin: string, userId: string, publicUid: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: pinAdditionalData(userId, publicUid) },
    await getPinEncryptionKey(),
    new TextEncoder().encode(pin),
  );
  return `v1.${base64UrlEncode(iv)}.${base64UrlEncode(new Uint8Array(ciphertext))}`;
}

async function decryptPin(value: string, userId: string, publicUid: string) {
  const match = /^v1\.([A-Za-z0-9_-]{16})\.([A-Za-z0-9_-]{28})$/.exec(value);
  if (!match) throw new Error('Stored account password has an invalid format.');
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64UrlDecode(match[1]), additionalData: pinAdditionalData(userId, publicUid) },
    await getPinEncryptionKey(),
    base64UrlDecode(match[2]),
  );
  const pin = new TextDecoder().decode(plaintext);
  if (!/^\d{5}$/.test(pin)) throw new Error('Stored account password could not be verified.');
  return pin;
}

async function hmac(value: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(await getPepper()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value)));
  return Array.from(signature, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index++) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

function randomCode() {
  const values = new Uint32Array(1);
  const limit = Math.floor(0x100000000 / 90000) * 90000;
  do crypto.getRandomValues(values); while (values[0] >= limit);
  return String(10000 + (values[0] % 90000));
}

function randomInternalPassword() {
  const bytes = new Uint8Array(48);
  crypto.getRandomValues(bytes);
  const random = btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
  return `Aa1!${random}`;
}

async function recoveryEmail(publicUid: string, userId: string) {
  const opaqueId = (await hmac(`recovery-email:${publicUid}:${userId}`)).slice(0, 48);
  return `account-${opaqueId}@restore.zynyro.invalid`;
}

async function authenticatedUser(request: Request) {
  const token = (request.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token || token === serviceKey) return null;
  const { data, error } = await admin.auth.getUser(token);
  return error ? null : data.user;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  try {
    const payload = await request.json();
    const action = payload?.action;

    if (action === 'change-password-with-credentials') {
      const publicUid = String(payload?.publicUid ?? '').trim();
      const currentPin = String(payload?.currentPin ?? '').trim();
      const newPin = String(payload?.newPin ?? '').trim();
      if (!/^\d{10}$/.test(publicUid) || !/^\d{5}$/.test(currentPin) || !/^\d{5}$/.test(newPin)) {
        return json({ error: 'Enter your 10-digit UID and both 5-digit passwords.' }, 400);
      }

      const { data: allowed, error: limitError } = await admin.rpc('claim_account_recovery_attempt', {
        p_public_uid: Number(publicUid),
      });
      if (limitError || allowed !== true) {
        return json({ error: 'Too many password checks. Please wait 5 minutes before trying again.' }, 429);
      }

      const { data: credential, error: credentialError } = await admin
        .from('account_recovery_credentials')
        .select('user_id, public_uid, code_hash')
        .eq('public_uid', Number(publicUid))
        .maybeSingle();
      if (credentialError) return json({ error: 'Could not update the password. Please try again.' }, 500);
      if (!credential) return json({ error: 'UID or current password is incorrect.' }, 401);

      const currentHash = await hmac(`recovery-code:${currentPin}`);
      if (!constantTimeEqual(currentHash, credential.code_hash)) {
        return json({ error: 'UID or current password is incorrect.' }, 401);
      }

      const codeHash = await hmac(`recovery-code:${newPin}`);
      const passwordCiphertext = await encryptPin(newPin, credential.user_id, publicUid);
      const { error: updateError } = await admin.from('account_recovery_credentials').update({
        code_hash: codeHash,
        password_ciphertext: passwordCiphertext,
        updated_at: new Date().toISOString(),
      }).eq('user_id', credential.user_id);
      if (updateError) {
        console.error('Account password change failed:', updateError.message);
        return json({ error: 'Could not update your password. Please try again.' }, 500);
      }

      await admin.from('account_recovery_attempts').delete().eq('public_uid', Number(publicUid));
      return json({ publicUid, configured: true });
    }

    if (action === 'status' || action === 'create' || action === 'set-password' || action === 'remember-password' || action === 'change-password') {
      const user = await authenticatedUser(request);
      if (!user) return json({ error: 'Session expired. Please sign in again.' }, 401);

      const { data: profile, error: profileError } = await admin
        .from('profiles')
        .select('public_uid')
        .eq('user_id', user.id)
        .maybeSingle();
      if (profileError || !profile?.public_uid) return json({ error: 'Your account ID is not ready yet.' }, 409);

      const publicUid = String(profile.public_uid);
      const { data: credential, error: credentialError } = await admin
        .from('account_recovery_credentials')
        .select('user_id, public_uid, code_hash, password_ciphertext')
        .eq('user_id', user.id)
        .maybeSingle();
      if (credentialError) return json({ error: 'Could not check recovery settings.' }, 500);

      if (action === 'status') {
        let pin: string | null = null;
        if (credential?.password_ciphertext) {
          try {
            pin = await decryptPin(credential.password_ciphertext, user.id, publicUid);
          } catch (error) {
            console.error('Saved account password could not be decrypted:', error instanceof Error ? error.message : 'Unknown error.');
            return json({ error: 'Could not unlock the saved password. Please contact support.' }, 503);
          }
        }
        return json({ configured: Boolean(credential), publicUid, pin });
      }

      if (action === 'remember-password') {
        const pin = String(payload?.pin ?? '').trim();
        if (!/^\d{5}$/.test(pin)) return json({ error: 'Enter the existing 5-digit password.' }, 400);
        if (!credential) return json({ error: 'This account does not have a password yet.' }, 409);
        const candidate = await hmac(`recovery-code:${pin}`);
        if (!constantTimeEqual(candidate, credential.code_hash)) return json({ error: 'That does not match your current password.' }, 401);
        if (!credential.password_ciphertext) {
          const passwordCiphertext = await encryptPin(pin, user.id, publicUid);
          const { error: updateError } = await admin.from('account_recovery_credentials')
            .update({ password_ciphertext, updated_at: new Date().toISOString() })
            .eq('user_id', user.id);
          if (updateError) return json({ error: 'Could not save your password securely. Please try again.' }, 500);
        }
        return json({ configured: true, saved: true });
      }

      if (action === 'change-password') {
        const currentPin = String(payload?.currentPin ?? '').trim();
        const newPin = String(payload?.newPin ?? '').trim();
        if (!/^\d{5}$/.test(currentPin) || !/^\d{5}$/.test(newPin)) return json({ error: 'Enter 5 digits for both passwords.' }, 400);
        if (!credential) return json({ error: 'Set your password during account setup first.' }, 409);
        const currentHash = await hmac(`recovery-code:${currentPin}`);
        if (!constantTimeEqual(currentHash, credential.code_hash)) return json({ error: 'Your current password is incorrect.' }, 401);
        const passwordCiphertext = await encryptPin(newPin, user.id, publicUid);
        const codeHash = await hmac(`recovery-code:${newPin}`);
        const { error: updateError } = await admin.from('account_recovery_credentials').update({
          code_hash: codeHash,
          password_ciphertext: passwordCiphertext,
          updated_at: new Date().toISOString(),
        }).eq('user_id', user.id);
        if (updateError) {
          console.error('Account password change failed:', updateError.message);
          return json({ error: 'Could not update your password. Please try again.' }, 500);
        }
        await admin.from('account_recovery_attempts').delete().eq('public_uid', profile.public_uid);
        return json({ publicUid, configured: true });
      }

      if (credential) {
        if (action !== 'create') {
          const requestedPin = String(payload?.pin ?? '').trim();
          if (!/^\d{5}$/.test(requestedPin)) return json({ error: 'Choose a 5-digit numeric password.' }, 400);
          const existingHash = await hmac(`recovery-code:${requestedPin}`);
          if (constantTimeEqual(existingHash, credential.code_hash)) {
            if (!credential.password_ciphertext) {
              const passwordCiphertext = await encryptPin(requestedPin, user.id, publicUid);
              const { error: updateError } = await admin.from('account_recovery_credentials')
                .update({ password_ciphertext, updated_at: new Date().toISOString() })
                .eq('user_id', user.id);
              if (updateError) return json({ error: 'Could not save your password securely. Please try again.' }, 500);
            }
            return json({ publicUid, configured: true });
          }
        }
        return json({ error: 'A password is already set. Use Change Your Password in Settings to replace it.' }, 409);
      }

      const pin = action === 'create' ? randomCode() : String(payload?.pin ?? '').trim();
      if (!/^\d{5}$/.test(pin)) return json({ error: 'Choose a 5-digit numeric password.' }, 400);

      const email = await recoveryEmail(publicUid, user.id);
      const { error: updateError } = await admin.auth.admin.updateUserById(user.id, {
        email,
        email_confirm: true,
        password: randomInternalPassword(),
      });
      if (updateError) {
        console.error('Recovery account setup failed:', updateError.message);
        return json({ error: 'Could not set up account recovery. Please try again.' }, 500);
      }

      const codeHash = await hmac(`recovery-code:${pin}`);
      const passwordCiphertext = await encryptPin(pin, user.id, publicUid);
      const { error: saveError } = await admin.from('account_recovery_credentials').insert({
        user_id: user.id,
        public_uid: profile.public_uid,
        code_hash: codeHash,
        password_ciphertext: passwordCiphertext,
        updated_at: new Date().toISOString(),
      });
      if (saveError) {
        if (saveError.code === '23505') {
          const { data: existing } = await admin.from('account_recovery_credentials')
            .select('code_hash')
            .eq('user_id', user.id)
            .maybeSingle();
          if (existing && constantTimeEqual(existing.code_hash, codeHash)) return json({ publicUid, configured: true });
        }
        console.error('Account password storage failed:', saveError.message);
        return json({ error: 'Could not save your password. Please try again.' }, 500);
      }

      await admin.from('account_recovery_attempts').delete().eq('public_uid', profile.public_uid);
      return action === 'create'
        ? json({ publicUid, pin })
        : json({ publicUid, configured: true });
    }

    if (action === 'recover') {
      const publicUid = String(payload?.publicUid ?? '').trim();
      const pin = String(payload?.pin ?? '').trim();
      if (!/^\d{10}$/.test(publicUid) || !/^\d{5}$/.test(pin)) {
        return json({ error: 'Invalid UID or password.' }, 400);
      }

      const { data: allowed, error: limitError } = await admin.rpc('claim_account_recovery_attempt', {
        p_public_uid: Number(publicUid),
      });
      if (limitError || allowed !== true) {
        return json({ error: 'Too many failed attempts. Please wait 5 minutes before trying again.' }, 429);
      }

      const { data: credential, error: credentialError } = await admin
        .from('account_recovery_credentials')
        .select('user_id, code_hash')
        .eq('public_uid', Number(publicUid))
        .maybeSingle();
      if (credentialError || !credential) return json({ error: 'Invalid UID or password.' }, 401);

      const candidate = await hmac(`recovery-code:${pin}`);
      if (!constantTimeEqual(candidate, credential.code_hash)) {
        return json({ error: 'Invalid UID or password.' }, 401);
      }

      const email = await recoveryEmail(publicUid, credential.user_id);
      const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
        type: 'magiclink',
        email,
      });
      const tokenHash = linkData?.properties?.hashed_token;
      if (linkError || !tokenHash) {
        console.error('Recovery session could not be created:', linkError?.message ?? 'Missing token hash.');
        return json({ error: 'Could not open this account right now. Please try again later.' }, 500);
      }

      await admin.from('account_recovery_attempts').delete().eq('public_uid', Number(publicUid));
      return json({ tokenHash });
    }

    return json({ error: 'Invalid request.' }, 400);
  } catch (error) {
    console.error('Account recovery error:', error instanceof Error ? error.message : 'Unknown error.');
    return json({ error: 'Could not complete account recovery.' }, 500);
  }
});
