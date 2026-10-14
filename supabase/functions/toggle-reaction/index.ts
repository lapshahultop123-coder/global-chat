import { createAdminClient } from '../_shared/adminClient.ts';

const admin = createAdminClient();
const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async(req)=>{
  if(req.method==='OPTIONS') return new Response('ok',{headers:corsHeaders});
  try {
    if(req.method!=='POST') return json({error:'Method not allowed.'},405);
    const token=(req.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'');
    const {data:{user},error}=await admin.auth.getUser(token);
    if(error||!user) return json({error:'Session expired.'},401);
    const {messageId,reaction}=await req.json();
    if(!['👍','❤️','😂','😮','😢','😡','🎉','🙏'].includes(reaction)) return json({error:'Invalid reaction.'},400);
    const {data,error:rpcError}=await admin.rpc('toggle_global_reaction',{p_user_id:user.id,p_message_id:messageId,p_reaction:reaction});
    if(rpcError) return json({error:'That message is no longer available.'},400);
    return json({active:data});
  } catch { return json({error:'Unable to update reaction.'},500); }
});



