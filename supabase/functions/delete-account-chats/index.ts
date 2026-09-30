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

async function removeAccountFiles(bucket: string, userId: string, extraPaths: unknown) {
  const paths = new Set<string>();
  if (Array.isArray(extraPaths)) {
    for (const path of extraPaths) {
      if (typeof path === 'string' && path.startsWith(`${userId}/`)) paths.add(path);
    }
  }

  // The database delete runs before Storage cleanup. Listing the account folder
  // also makes a retry clean up files left behind if a previous removal failed.
  const { data: files, error: listError } = await admin.storage.from(bucket).list(userId, { limit: 1000 });
  if (listError) throw listError;
  for (const file of files ?? []) {
    if (file.name && !file.name.includes('/')) paths.add(`${userId}/${file.name}`);
  }
  if (paths.size === 0) return;
  const { error } = await admin.storage.from(bucket).remove([...paths]);
  if (error) throw error;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  try {
    const token = (request.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    if (!token || token === serviceKey) return json({ error: 'Authentication required.' }, 401);
    const { data: { user }, error: authError } = await admin.auth.getUser(token);
    if (authError || !user) return json({ error: 'Session expired. Please sign in again.' }, 401);

    const { data, error } = await admin.rpc('delete_account_chat_messages', { p_user_id: user.id });
    if (error || !data) {
      console.error('Chat history removal failed:', error?.message ?? 'No result.');
      return json({ error: 'Could not delete your messages. Please try again.' }, 500);
    }

    try {
      await Promise.all([
        removeAccountFiles('voice-messages', user.id, data.public_voice_paths),
        removeAccountFiles('friend-voice-messages', user.id, data.friend_voice_paths),
        removeAccountFiles('private-voice-messages', user.id, data.private_voice_paths),
      ]);
    } catch (storageError) {
      console.error('Chat history voice cleanup failed:', storageError instanceof Error ? storageError.message : 'Unknown error.');
      return json({ error: 'Your text messages were removed, but some voice files need cleanup. Please retry.' }, 500);
    }

    return json({ ok: true });
  } catch (error) {
    console.error('Chat history removal error:', error instanceof Error ? error.message : 'Unknown error.');
    return json({ error: 'Could not delete your messages. Please try again.' }, 500);
  }
});
