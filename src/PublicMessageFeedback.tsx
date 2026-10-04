import { useEffect, useState } from 'react';
import { Check, CircleHelp, Clock3 } from 'lucide-react';
import { supabase } from './lib/supabase';
const tags=[['helpful','Helpful'],['needs_answer','Needs answer'],['outdated','Outdated']] as const;
export default function PublicMessageFeedback({messageId,userId}:{messageId:string;userId:string}){
 const [rows,setRows]=useState<{user_id:string;feedback_tag:string}[]>([]),[busy,setBusy]=useState(false);
 useEffect(()=>{let active=true;void supabase.from('public_message_feedback').select('user_id,feedback_tag').eq('message_id',messageId).then(({data})=>{if(active)setRows((data||[]) as any[])});return()=>{active=false}},[messageId]);
 const toggle=async(tag:string)=>{if(busy)return;setBusy(true);const {data,error}=await supabase.rpc('toggle_public_message_feedback',{p_message_id:messageId,p_feedback_tag:tag});if(!error)setRows(previous=>data?[...previous,{user_id:userId,feedback_tag:tag}]:previous.filter(row=>!(row.user_id===userId&&row.feedback_tag===tag)));setBusy(false)};
 return <div className="public-message-feedback" aria-label="Message feedback tags">{tags.map(([key,label])=>{const count=rows.filter(row=>row.feedback_tag===key).length,active=rows.some(row=>row.user_id===userId&&row.feedback_tag===key);const Icon=key==='helpful'?Check:key==='needs_answer'?CircleHelp:Clock3;return <button type="button" key={key} className={active?'active':''} aria-pressed={active} disabled={busy} onClick={()=>void toggle(key)}><Icon size={12}/><span>{label}</span>{count>0&&<small>{count}</small>}</button>})}</div>;
}
