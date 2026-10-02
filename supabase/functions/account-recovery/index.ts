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

    if (action === 'status' || action === 'create' || action === 'set-password') {
      const user = await authenticatedUser(request);
      if (!user) return json({ error: 'Session expired. Please sign in again.' }, 401);

      const { data: profile, error: profileError } = await admin
        .from('profiles')
        .select('public_uid')
        .eq('user_id', user.id)
        .maybeSingle();
      if (profileError || !profile?.public_uid) return json({ error: 'Your account ID is not ready yet.' }, 409);

      if (action === 'status') {
        const { data, error } = await admin
          .from('account_recovery_credentials')
          .select('user_id')
          .eq('user_id', user.id)
          .maybeSingle();
        if (error) return json({ error: 'Could not check recovery settings.' }, 500);
        return json({ configured: Boolean(data), publicUid: String(profile.public_uid) });
      }

      const pin = action === 'create' ? randomCode() : String(payload?.pin ?? '').trim();
      if (!/^\d{5}$/.test(pin)) return json({ error: 'Choose a 5-digit numeric password.' }, 400);

      const publicUid = String(profile.public_uid);
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
      const { error: saveError } = await admin.from('account_recovery_credentials').upsert({
        user_id: user.id,
        public_uid: profile.public_uid,
        code_hash: codeHash,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
      if (saveError) {
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
        return json({ error: 'Too many attempts. Try again after 24 hours, or reset the code from a signed-in device.' }, 429);
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
