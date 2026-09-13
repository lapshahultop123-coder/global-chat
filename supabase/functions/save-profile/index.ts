import { createClient } from 'npm:@supabase/supabase-js@2';
import { iso31661, iso31662 } from 'npm:iso-3166@4.4.0';

const SUPABASE_SECRET_KEYS = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')!);
const admin = createClient(Deno.env.get('SUPABASE_URL')!, SUPABASE_SECRET_KEYS['default'], { auth: { persistSession: false, autoRefreshToken: false } });
const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
const themes = ['midnight','ocean','sunset','forest','galaxy','arctic','pink','carbon','aurora','gold','crimson','mint','royal','lavender','coffee','coral','slate','emerald','violet','sky','sand','rose','teal','indigo','mono'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    const { data: { user }, error } = await admin.auth.getUser(token);
    if (error || !user || !user.is_anonymous) return json({ error: 'Session expired.' }, 401);
    const p = await req.json();
    const c = iso31661.find(x => x.state === 'assigned' && x.alpha2 === p.country);
    const s = iso31662.find(x => x.code === p.subdivision && x.code.startsWith(`${p.country}-`));
    if (!c || !s || !Number.isInteger(p.avatarId) || p.avatarId < 1 || p.avatarId > 100 || !themes.includes(p.themeId) || typeof p.name !== 'string' || p.name.trim().length < 2 || p.name.trim().length > 32 || p.agreed !== true) return json({ error: 'Invalid profile.' }, 400);
    const { error: up } = await admin.from('profiles').upsert({ user_id: user.id, name: p.name.trim(), country: p.country, subdivision: p.subdivision, avatar_id: p.avatarId, theme_id: p.themeId, agreed: true, updated_at: new Date().toISOString() });
    if (up) return json({ error: 'Could not save profile.' }, 500);
    return json({ ok: true });
  } catch { return json({ error: 'Could not save profile.' }, 500); }
});
