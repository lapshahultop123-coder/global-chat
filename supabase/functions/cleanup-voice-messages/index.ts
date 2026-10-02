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

async function removeExpiredVoice(bucket: string, rows: any[]) {
  if (!rows.length) return;
  const { error } = await admin.storage.from(bucket).remove(rows.map((row) => row.storage_path));
  if (error) throw error;
}

async function deleteExpiredRows(table: string, rows: any[]) {
  if (!rows.length) return;
  const { error } = await admin.from(table).delete().in('id', rows.map((row) => row.id));
  if (error) throw error;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  try {
    const now = new Date().toISOString();
    const results = await Promise.all([
      admin.from('messages').select('id').lte('expires_at', now).limit(500),
      admin.from('voice_messages').select('id,storage_path').lte('expires_at', now).limit(100),
      admin.from('private_messages').select('id').lte('expires_at', now).limit(500),
      admin.from('private_voice_messages').select('id,storage_path').lte('expires_at', now).limit(100),
      admin.from('friend_messages').select('id').lte('expires_at', now).limit(500),
      admin.from('friend_voice_messages').select('id,storage_path').lte('expires_at', now).limit(100),
    ]);
    const [publicText, publicVoice, privateText, privateVoice, friendText, friendVoice] = results;
    const failure = results.find((result) => result.error)?.error;
    if (failure) throw failure;

    await Promise.all([
      removeExpiredVoice('voice-messages', publicVoice.data ?? []),
      removeExpiredVoice('private-voice-messages', privateVoice.data ?? []),
      removeExpiredVoice('friend-voice-messages', friendVoice.data ?? []),
    ]);

    const friendTextIds = (friendText.data ?? []).map((row) => row.id);
    const friendVoiceIds = (friendVoice.data ?? []).map((row) => row.id);
    if (friendTextIds.length || friendVoiceIds.length) {
      const cleanup = await Promise.all([
        friendTextIds.length
          ? admin.from('friend_message_reactions').delete().eq('message_kind', 'text').in('message_id', friendTextIds)
          : Promise.resolve({ error: null }),
        friendVoiceIds.length
          ? admin.from('friend_message_reactions').delete().eq('message_kind', 'voice').in('message_id', friendVoiceIds)
          : Promise.resolve({ error: null }),
        friendTextIds.length
          ? admin.from('friend_message_hidden').delete().eq('message_kind', 'text').in('message_id', friendTextIds)
          : Promise.resolve({ error: null }),
        friendVoiceIds.length
          ? admin.from('friend_message_hidden').delete().eq('message_kind', 'voice').in('message_id', friendVoiceIds)
          : Promise.resolve({ error: null }),
      ]);
      const cleanupError = cleanup.find((result) => result.error)?.error;
      if (cleanupError) throw cleanupError;
    }

    await Promise.all([
      deleteExpiredRows('messages', publicText.data ?? []),
      deleteExpiredRows('voice_messages', publicVoice.data ?? []),
      deleteExpiredRows('private_messages', privateText.data ?? []),
      deleteExpiredRows('private_voice_messages', privateVoice.data ?? []),
      deleteExpiredRows('friend_messages', friendText.data ?? []),
      deleteExpiredRows('friend_voice_messages', friendVoice.data ?? []),
    ]);

    return json({
      deleted: {
        publicText: publicText.data?.length ?? 0,
        publicVoice: publicVoice.data?.length ?? 0,
        privateText: privateText.data?.length ?? 0,
        privateVoice: privateVoice.data?.length ?? 0,
        friendText: friendText.data?.length ?? 0,
        friendVoice: friendVoice.data?.length ?? 0,
      },
    });
  } catch (error) {
    console.error('Expired chat cleanup failed:', error instanceof Error ? error.message : 'Unknown error.');
    return json({ error: 'Cleanup failed.' }, 500);
  }
});
