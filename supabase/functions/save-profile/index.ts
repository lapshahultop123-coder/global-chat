import { createAdminClient } from '../_shared/adminClient.ts';
import { iso31661, iso31662 } from 'npm:iso-3166@4.4.0';

const admin = createAdminClient();
const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
const themes = ['midnight','ocean','sunset','forest','galaxy','arctic','pink','carbon','aurora','gold','crimson','mint','royal','lavender','coffee','coral','slate','emerald','violet','sky','sand','rose','teal','indigo','mono','deep-space','sapphire','cobalt','glacier','jade','moss','plum','amethyst','berry','ruby','copper','amber','olive','steel','twilight'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    const { data: { user }, error } = await admin.auth.getUser(token);
    if (error || !user) return json({ error: 'Session expired.' }, 401);
    const p = await req.json();
    const c = iso31661.find(x => x.state === 'assigned' && x.alpha2 === p.country);
    const s = iso31662.find(x => x.code === p.subdivision && x.code.startsWith(`${p.country}-`));
    const hasSubdivisions = iso31662.some(x => x.code.startsWith(`${p.country}-`));
    const validSubdivision = hasSubdivisions ? !!s : p.subdivision === '';
    const profileIntro = typeof p.profileIntro === 'string' ? p.profileIntro.trim() : '';
    const profileIntroVisibility = ['everyone', 'friends', 'hidden'].includes(p.profileIntroVisibility) ? p.profileIntroVisibility : 'hidden';
    if (!c || !validSubdivision || !Number.isInteger(p.avatarId) || p.avatarId < 1 || p.avatarId > 1262 || !themes.includes(p.themeId) || typeof p.name !== 'string' || p.name.trim().length < 2 || p.name.trim().length > 32 || profileIntro.length > 80 || p.agreed !== true) return json({ error: 'Invalid profile.' }, 400);
    const { error: up } = await admin.from('profiles').upsert({ user_id: user.id, name: p.name.trim(), country: p.country, subdivision: p.subdivision, show_country: p.showCountry !== false, show_subdivision: p.showSubdivision !== false, profile_intro: profileIntro, profile_intro_visibility: profileIntroVisibility, avatar_id: p.avatarId, theme_id: p.themeId, agreed: true, updated_at: new Date().toISOString() });
    if (up) return json({ error: 'Could not save profile.' }, 500);
    return json({ ok: true });
  } catch { return json({ error: 'Could not save profile.' }, 500); }
});
