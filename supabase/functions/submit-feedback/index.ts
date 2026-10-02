import { createClient } from 'npm:@supabase/supabase-js@2';

const rawSecret = Deno.env.get('SUPABASE_SECRET_KEYS')
  || Deno.env.get('SUPABASE_SECRET_KEY')
  || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  || '';
let serviceKey = rawSecret;
try {
  const parsed = JSON.parse(rawSecret);
  serviceKey = parsed.default || parsed.service_role || parsed.key || rawSecret;
} catch {}

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const admin = serviceKey
  ? createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  try {
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    if (!token) return json({ error: 'Please log in again before sending a report.' }, 401);
    if (!admin) return json({ error: 'Report service is not configured. Please try again later.' }, 503);

    const { data: { user }, error: authError } = await admin.auth.getUser(token);
    if (authError || !user) return json({ error: 'Your session expired. Please log in again.' }, 401);

    const payload = await req.json();
    const type = String(payload?.type ?? 'bug').trim().slice(0, 40);
    const description = String(payload?.description ?? '').trim().slice(0, 4000);
    const page = String(payload?.page ?? '').trim().slice(0, 120);
    const userName = String(payload?.profile?.name ?? 'Anonymous').trim().slice(0, 80) || 'Anonymous';

    if (!['bug', 'feedback', 'not-working'].includes(type)) return json({ error: 'Invalid report type.' }, 400);
    if (description.length < 5) return json({ error: 'Please provide a more detailed report.' }, 400);

    const row = {
      user_id: user.id,
      user_name: userName,
      report_type: type,
      description,
      page: page || null,
      status: 'new',
    };
    let { error: insertError } = await admin.from('feedback_reports').insert(row);

    // Older deployments may not yet have the optional display-name column.
    if (insertError?.code === 'PGRST204' || (insertError?.code === '42703' && /user_name/i.test(insertError.message))) {
      const { user_name: _userName, ...compatibleRow } = row;
      ({ error: insertError } = await admin.from('feedback_reports').insert(compatibleRow));
    }

    if (insertError) {
      console.error('Feedback insert failed:', insertError.code, insertError.message);
      return json({ error: 'Could not save the report. Please retry in a moment.' }, 500);
    }

    return json({ ok: true, message: 'Report submitted successfully.' });
  } catch (error) {
    console.error('submit-feedback error:', error);
    return json({ error: 'Could not submit the report. Please try again.' }, 500);
  }
});
