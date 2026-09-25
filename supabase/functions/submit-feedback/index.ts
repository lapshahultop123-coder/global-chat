import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) return json({ error: 'Authentication required.' }, 401);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return json({ error: 'Authentication required.' }, 401);

    const payload = await req.json();
    const type = String(payload?.type ?? 'bug').slice(0, 40);
    const description = String(payload?.description ?? '').trim().slice(0, 4000);
    const page = String(payload?.page ?? '').trim().slice(0, 120);
    const profile = payload?.profile ?? {};

    if (description.length < 5) return json({ error: 'Please provide a more detailed report.' }, 400);

    const resendKey = Deno.env.get('RESEND_API_KEY') ?? '';
    const primary = Deno.env.get('FEEDBACK_PRIMARY_EMAIL') ?? '';
    const secondary = Deno.env.get('FEEDBACK_SECONDARY_EMAIL') ?? '';
    const from = Deno.env.get('FEEDBACK_FROM_EMAIL') ?? '';

    if (!resendKey || !primary || !from) {
      return json({ error: 'Feedback delivery is not configured yet. Please try again later.' }, 503);
    }

    const recipients = [primary, secondary].filter(Boolean);
    const label = type === 'feedback' ? 'Feedback' : type === 'not-working' ? 'Something not working' : 'Bug / Error';
    const safeName = String(profile?.name ?? 'Anonymous').slice(0, 80);
    const safeCountry = String(profile?.country ?? '').slice(0, 10);
    const safeSubdivision = String(profile?.subdivision ?? '').slice(0, 80);
    const subject = `[Zynyro ${label}] ${page || 'User report'}`.slice(0, 180);
    const text = [
      `Report type: ${label}`,
      `User: ${safeName}`,
      `User ID: ${user.id}`,
      `Location profile: ${safeSubdivision}${safeCountry ? `, ${safeCountry}` : ''}`,
      `Page / feature: ${page || 'Not specified'}`,
      `Submitted: ${new Date().toISOString()}`,
      '',
      'Description:',
      description,
    ].join('\n');

    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to: recipients, subject, text }),
    });

    if (!emailResponse.ok) {
      const detail = await emailResponse.text();
      console.error('Resend error:', detail);
      return json({ error: 'The report could not be delivered right now.' }, 502);
    }

    return json({ ok: true });
  } catch (error) {
    console.error('submit-feedback error:', error);
    return json({ error: 'Could not submit the report.' }, 500);
  }
});
