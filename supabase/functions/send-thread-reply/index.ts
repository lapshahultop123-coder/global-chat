import { createClient } from 'npm:@supabase/supabase-js@2';
import { iso31661, iso31662 } from 'npm:iso-3166@4.4.0';

const secrets = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')!);
const admin = createClient(Deno.env.get('SUPABASE_URL')!, secrets.default, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const allowedEmoji = new Set([
  '😀','😃','😄','😁','😆','😅','😂','🤣','😊','😇','🙂','🙃','😉','😌','😍','🥰','😘','😗','😙','😚',
  '😋','😛','😝','😜','🤪','🤨','🧐','🤓','😎','🤩','🥳','😏','😒','😞','😔','😟','😕','🙁','☹️','😣',
  '😖','😫','😩','🥺','😢','😭','😤','😠','😡','🤬','🤯','😳','🥵','🥶','😱','😨','😰','😥','😓','🤗',
  '👍','👎','👏','🙌','🙏','👋','💪','🔥','❤️','💯',
]);
const bad = ['fuck','fucking','shit','bitch','bastard','asshole','dick','pussy','cunt','motherfucker','slut','whore'];
const normalize = (value: string) => value.normalize('NFKC').toLowerCase()
  .replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/[^a-z0-9]+/g, '').replace(/(.)\1+/g, '$1');

function englishOnly(value: string) {
  let index = 0;
  while (index < value.length) {
    const emoji = [...allowedEmoji].find(item => value.startsWith(item, index));
    if (emoji) { index += emoji.length; continue; }
    const codePoint = value.codePointAt(index)!;
    const character = String.fromCodePoint(codePoint);
    if (!/[A-Za-z0-9\s\p{P}\p{S}]/u.test(character)) return false;
    index += character.length;
  }
  return true;
}

function validProfile(profile: any) {
  const country = iso31661.find(item => item.state === 'assigned' && item.alpha2 === profile?.country);
  const subdivision = iso31662.find(item => item.code === profile?.subdivision && item.code.startsWith(`${profile?.country}-`));
  return !!country && !!subdivision && Number.isInteger(profile?.avatarId) && profile.avatarId >= 1 &&
    profile.avatarId <= 1262 && typeof profile?.name === 'string' && profile.name.trim().length >= 2 &&
    profile.name.trim().length <= 32 && profile.agreed === true;
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  try {
    const token = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    const { data: { user }, error: authError } = await admin.auth.getUser(token);
    if (authError || !user) return json({ error: 'Session expired. Please sign in again.' }, 401);

    const { messageId, text, profile } = await request.json();
    if (typeof messageId !== 'string' || !/^[0-9a-f-]{36}$/i.test(messageId)) {
      return json({ error: 'Invalid message thread.' }, 400);
    }
    if (!validProfile(profile)) return json({ error: 'Your profile information is invalid. Please update it.' }, 400);

    const body = String(text ?? '');
    if ([...body].length < 1 || [...body].length > 500) {
      return json({ error: 'Messages can contain up to 500 characters.' }, 400);
    }
    if (!englishOnly(body)) {
      return json({ error: 'English only. Please use English letters, numbers, symbols, and approved emojis.' }, 400);
    }
    const normalized = normalize(body);
    if (bad.some(word => normalized.includes(word))) {
      return json({ error: 'Please use respectful language. Offensive language is not allowed.' }, 400);
    }

    const { data, error } = await admin.rpc('accept_message_thread_reply', {
      p_user_id: user.id,
      p_message_id: messageId,
      p_name: profile.name.trim(),
      p_country: profile.country,
      p_subdivision: profile.subdivision,
      p_avatar_id: profile.avatarId,
      p_body: body,
    });
    if (error) {
      const errors: Record<string, string> = {
        rate_limited: 'Please wait a moment before sending more messages.',
        duplicate_message: 'Please do not send the same message again so quickly.',
        message_length: 'Messages can contain up to 500 characters.',
        thread_root_expired: 'This message has expired; its discussion is closed.',
      };
      return json({ error: errors[error.message] || 'Unable to send this thread reply.' }, 400);
    }
    return json({ reply: data });
  } catch {
    return json({ error: 'Unable to send this thread reply right now.' }, 500);
  }
});
