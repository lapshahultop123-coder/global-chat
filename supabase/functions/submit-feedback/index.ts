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
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed.' }, 405);
  }

  try {
    const authHeader = req.headers.get('Authorization') ?? '';

    if (!authHeader.startsWith('Bearer ')) {
      return json({ error: 'Authentication required.' }, 401);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: {
            Authorization: authHeader,
          },
        },
      },
    );

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return json({ error: 'Authentication required.' }, 401);
    }

    const payload = await req.json();

    const type = String(payload?.type ?? 'bug').trim().slice(0, 40);
    const description = String(payload?.description ?? '')
      .trim()
      .slice(0, 4000);
    const page = String(payload?.page ?? '')
      .trim()
      .slice(0, 120);

    const profile = payload?.profile ?? {};
    const userName = String(profile?.name ?? 'Anonymous')
      .trim()
      .slice(0, 80);

    if (!['bug', 'feedback', 'not-working'].includes(type)) {
      return json({ error: 'Invalid report type.' }, 400);
    }

    if (description.length < 5) {
      return json(
        { error: 'Please provide a more detailed report.' },
        400,
      );
    }

    const { error: insertError } = await supabase
      .from('feedback_reports')
      .insert({
        user_id: user.id,
        user_name: userName || 'Anonymous',
        report_type: type,
        description,
        page: page || null,
        status: 'new',
      });

    if (insertError) {
      console.error('Feedback insert error:', insertError);
      return json(
        { error: 'Could not save the report right now.' },
        500,
      );
    }

    return json({
      ok: true,
      message: 'Report submitted successfully!',
    });
  } catch (error) {
    console.error('submit-feedback error:', error);

    return json(
      { error: 'Could not submit the report.' },
      500,
    );
  }
});
