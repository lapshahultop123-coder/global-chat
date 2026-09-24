import { createClient } from 'npm:@supabase/supabase-js@2';

const rawSecret=Deno.env.get('SUPABASE_SECRET_KEYS')||Deno.env.get('SUPABASE_SECRET_KEY')||Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
let serviceKey=rawSecret;
try{const parsed=JSON.parse(rawSecret);serviceKey=parsed.default||parsed.service_role||parsed.key||rawSecret}catch{}
const admin=createClient(Deno.env.get('SUPABASE_URL')!,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});

const C={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
const json=(x:unknown,s=200)=>new Response(JSON.stringify(x),{status:s,headers:{...C,'Content-Type':'application/json'}});

Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:C});
  try{
    if(req.method!=='POST')return json({error:'Method not allowed.'},405);
    const token=(req.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'');
    const {data:{user},error:u}=await admin.auth.getUser(token);
    if(u||!user?.is_anonymous)return json({error:'Session expired. Please re-enter the chat.'},401);
    const f=await req.formData(),audio=f.get('audio'),durationMs=Number(f.get('durationMs')||0),replyToMessageId=String(f.get('replyToMessageId')||'')||null,replyToVoiceId=String(f.get('replyToVoiceId')||'')||null;
    if(!(audio instanceof File))return json({error:'Voice recording is required.'},400);
    if(durationMs<500||durationMs>60000)return json({error:'Voice recordings can be up to 1 minute.'},400);
    if(audio.size<1||audio.size>358400)return json({error:'Voice message is too large. Please record a shorter message.'},400);

    // Browsers may append parameters such as ;codecs=opus to the MIME type.
    const mime=audio.type.split(';')[0].trim().toLowerCase();
    const allowed=['audio/webm','audio/mp4','audio/x-m4a'];
    if(!allowed.includes(mime))return json({error:'Unsupported audio format.'},400);

    const path=`${user.id}/${crypto.randomUUID()}.${mime==='audio/webm'?'webm':'m4a'}`;
    const up=await admin.storage.from('voice-messages').upload(path,new Uint8Array(await audio.arrayBuffer()),{contentType:mime,upsert:false,cacheControl:'180'});
    if(up.error)return json({error:'Could not store the voice message.'},500);

    const {data:{publicUrl}}=admin.storage.from('voice-messages').getPublicUrl(path);
    const {data:p,error:pe}=await admin.from('profiles').select('name,country,subdivision,avatar_id,agreed').eq('user_id',user.id).maybeSingle();
    if(pe||!p?.agreed){await admin.storage.from('voice-messages').remove([path]);return json({error:'Your profile information is invalid. Please update it.'},400)}

    const {data,error}=await admin.rpc('accept_voice_message',{p_user_id:user.id,p_name:p.name,p_country:p.country,p_subdivision:p.subdivision,p_avatar_id:p.avatar_id,p_audio_url:publicUrl,p_storage_path:path,p_duration_ms:durationMs,p_file_size:audio.size,p_reply_to_id:replyToMessageId,p_reply_to_voice_id:replyToVoiceId});
    if(error){
      await admin.storage.from('voice-messages').remove([path]);
      const m:any={rate_limited:'Please wait a moment before sending more messages.',duration_invalid:'Voice recordings can be up to 1 minute.',file_too_large:'Voice message is too large. Please record a shorter message.'};
      return json({error:m[error.message]||'Unable to send voice message.'},400);
    }
    return json({message:data});
  }catch{return json({error:'Unable to send voice message right now.'},500)}});
