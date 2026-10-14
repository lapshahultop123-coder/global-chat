import { createAdminClient } from '../_shared/adminClient.ts';
import { iso31661, iso31662 } from 'npm:iso-3166@4.4.0';
const admin = createAdminClient();
const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
const allowedEmoji = new Set(['😀','😃','😄','😁','😆','😅','😂','🤣','😊','😇','🙂','🙃','😉','😌','😍','🥰','😘','😗','😙','😚','😋','😛','😝','😜','🤪','🤨','🧐','🤓','😎','🤩','🥳','😏','😒','😞','😔','😟','😕','🙁','☹️','😣','😖','😫','😩','🥺','😢','😭','😤','😠','😡','🤬','🤯','😳','🥵','🥶','😱','😨','😰','😥','😓','🤗','👍','👎','👏','🙌','🙏','👋','💪','🔥','❤️','💯']);
const bad = ['fuck','fucking','shit','bitch','bastard','asshole','dick','pussy','cunt','motherfucker','slut','whore'];
const normalize = (s: string) => s.normalize('NFKC').toLowerCase().replace(/[\u200B-\u200D\uFEFF]/g,'').replace(/[^a-z0-9]+/g,'').replace(/(.)\1+/g,'$1');
function englishOnly(s:string){ let i=0; while(i<s.length){ let matched=false; for(const emoji of allowedEmoji){ if(s.startsWith(emoji,i)){ i+=emoji.length; matched=true; break; } } if(matched) continue; const cp=s.codePointAt(i)!; const ch=String.fromCodePoint(cp); if(/[A-Za-z0-9\s\p{P}\p{S}]/u.test(ch)){ i+=ch.length; continue; } return false; } return true; }
function offensive(s:string){ const n=normalize(s); return bad.some(w=>n.includes(w)); }
function okProfile(p:any){ const c=iso31661.find(x=>x.state==='assigned'&&x.alpha2===p.country); const sub=iso31662.find(x=>x.code===p.subdivision && x.code.startsWith(`${p.country}-`)); const hasSubdivisions=iso31662.some(x=>x.code.startsWith(`${p.country}-`)); const validSubdivision=hasSubdivisions?!!sub:p.subdivision===''; return !!c&&validSubdivision&&Number.isInteger(p.avatarId)&&p.avatarId>=1&&p.avatarId<=1262&&typeof p.name==='string'&&p.name.trim().length>=2&&p.name.trim().length<=32&&p.agreed===true; }
Deno.serve(async(req)=>{
  if(req.method==='OPTIONS') return new Response('ok',{headers:corsHeaders});
  try {
    if(req.method!=='POST') return json({error:'Method not allowed.'},405);
    const token=(req.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'');
    const {data:{user},error:uerr}=await admin.auth.getUser(token);
    if(uerr||!user) return json({error:'Session expired. Please re-enter the chat.'},401);
    const {text,profile,replyToId,replyToVoiceId,clientRequestId}=await req.json();
    if(!okProfile(profile)) return json({error:'Your profile information is invalid. Please update it.'},400);
    const body=String(text??'');
    if([...body].length<1||[...body].length>550) return json({error:'Messages can contain up to 550 characters.'},400);
    if(!englishOnly(body)) return json({error:'English only. Please use English letters, numbers, symbols, and approved emojis.'},400);
    if(offensive(body)) return json({error:'Please use respectful language. Offensive language is not allowed.'},400);
    const replyId=typeof replyToId==='string'&&replyToId?replyToId:null;
    const voiceReplyId=typeof replyToVoiceId==='string'&&replyToVoiceId?replyToVoiceId:null;
    const hasRequestId=typeof clientRequestId==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(clientRequestId);
    if(clientRequestId&&!hasRequestId)return json({error:'Invalid message request. Please retry.'},400);
    const rpcArgs=hasRequestId
      ? {p_user_id:user.id,p_name:profile.name.trim(),p_country:profile.country,p_subdivision:profile.subdivision,p_avatar_id:profile.avatarId,p_body:body,p_reply_to_id:replyId,p_reply_to_voice_id:voiceReplyId,p_client_request_id:clientRequestId}
      : {p_user_id:user.id,p_name:profile.name.trim(),p_country:profile.country,p_subdivision:profile.subdivision,p_avatar_id:profile.avatarId,p_body:body,p_reply_to_id:replyId,p_reply_to_voice_id:voiceReplyId};
    const {data,error}=await admin.rpc('accept_global_message',rpcArgs);
    if(error){
console.error("accept_global_message RPC failed:", error);
 const map:any={rate_limited:'Please wait a moment before sending more messages.',duplicate_message:'Please do not send the same message again so quickly.',message_length:'Messages can contain up to 550 characters.',invalid_avatar:'Invalid avatar selection.',invalid_name:'Invalid nickname.',reply_target_invalid:'That message can no longer be replied to.',idempotency_key_conflict:'This send could not be matched safely. Please start a new message.'}; return json({error:map[error.message]||'Unable to send message.'},400); }
    return json({message:data});
  } catch { return json({error:'Unable to send message right now.'},500); }
});
