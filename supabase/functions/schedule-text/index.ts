import { createClient } from 'npm:@supabase/supabase-js@2';
import { iso31661, iso31662 } from 'npm:iso-3166@4.4.0';

const secrets=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')!);
const admin=createClient(Deno.env.get('SUPABASE_URL')!,secrets.default,{auth:{persistSession:false,autoRefreshToken:false}});
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}});
const allowedEmoji=['😀','😃','😄','😁','😆','😅','😂','🤣','😊','😇','🙂','🙃','😉','😌','😍','🥰','😘','😗','😙','😚','😋','😛','😝','😜','🤪','🤨','🧐','🤓','😎','🤩','🥳','😏','😒','😞','😔','😟','😕','🙁','☹️','😣','😖','😫','😩','🥺','😢','😭','😤','😠','😡','🤬','🤯','😳','🥵','🥶','😱','😨','😰','😥','😓','🤗','👍','👎','👏','🙌','🙏','👋','💪','🔥','❤️','💯'];
const banned=['fuck','fucking','shit','bitch','bastard','asshole','dick','pussy','cunt','motherfucker','slut','whore'];
const normalize=(value:string)=>value.normalize('NFKC').toLowerCase().replace(/[\u200B-\u200D\uFEFF]/g,'').replace(/[^a-z0-9]+/g,'').replace(/(.)\1+/g,'$1');
function englishOnly(value:string){let i=0;while(i<value.length){const emoji=allowedEmoji.find(item=>value.startsWith(item,i));if(emoji){i+=emoji.length;continue}const cp=value.codePointAt(i)!;const char=String.fromCodePoint(cp);if(/[A-Za-z0-9\s\p{P}\p{S}]/u.test(char)){i+=char.length;continue}return false}return true}
Deno.serve(async(req)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 try{
  if(req.method!=='POST')return json({error:'Method not allowed.'},405);
  const token=(req.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'');
  const {data:{user},error:authError}=await admin.auth.getUser(token);
  if(authError||!user)return json({error:'Sign in again to schedule a message.'},401);
  const {data:profile,error:profileError}=await admin.from('profiles').select('name,country,subdivision,avatar_id,agreed').eq('user_id',user.id).maybeSingle();
  if(profileError||!profile)return json({error:'Your profile could not be loaded.'},400);
  const country=iso31661.find(x=>x.state==='assigned'&&x.alpha2===profile.country);
  const subdivision=iso31662.find(x=>x.code===profile.subdivision&&x.code.startsWith(`${profile.country}-`));
  if(!country||!subdivision||!profile.agreed||typeof profile.name!=='string'||profile.name.trim().length<2||profile.name.trim().length>32||!Number.isInteger(profile.avatar_id)||profile.avatar_id<1||profile.avatar_id>1262)return json({error:'Your profile information is invalid. Please update it.'},400);
  const payload=await req.json();
  const context=payload.context;
  const targetId=typeof payload.targetId==='string'?payload.targetId:null;
  const body=typeof payload.body==='string'?payload.body.trim():'';
  const scheduledAt=new Date(payload.scheduledAt);
  if(!['public','private','friend'].includes(context))return json({error:'Invalid chat type.'},400);
  if([...body].length<1||[...body].length>500)return json({error:'Messages can contain up to 500 characters.'},400);
  if(!englishOnly(body))return json({error:'English only. Please use English letters, numbers, symbols, and approved emojis.'},400);
  if(banned.some(word=>normalize(body).includes(word)))return json({error:'Please use respectful language. Offensive language is not allowed.'},400);
  if(!Number.isFinite(scheduledAt.getTime())||scheduledAt.getTime()<Date.now()+60_000||scheduledAt.getTime()>Date.now()+30*24*60*60_000)return json({error:'Choose a time at least one minute from now and within 30 days.'},400);
  if(context!=='public'&&(!targetId||!/^[0-9a-f-]{36}$/i.test(targetId)))return json({error:'Select a valid chat.'},400);
  const {data,error}=await admin.rpc('schedule_chat_text',{p_user_id:user.id,p_context:context,p_room_id:context==='private'?targetId:null,p_recipient_id:context==='friend'?targetId:null,p_body:body,p_scheduled_at:scheduledAt.toISOString(),p_sender_name:profile.name.trim(),p_country:profile.country,p_subdivision:profile.subdivision,p_avatar_id:profile.avatar_id});
  if(error){const map:Record<string,string>={not_private_member:'You are no longer a member of this private chat.',not_friend:'You are no longer friends with this person.',schedule_must_be_within_30_days:'Choose a time within 30 days.'};return json({error:map[error.message]||'Could not schedule this message.'},400)}
  return json({ok:true,message:data});
 }catch(error){console.error('schedule-text failed',error);return json({error:'Could not schedule this message. Please try again.'},500)}
});
