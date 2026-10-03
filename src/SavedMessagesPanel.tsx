import { useEffect,useState } from 'react';
import { Bookmark,Trash2,X } from 'lucide-react';
import { supabase } from './lib/supabase';
type Saved={id:string;source_context:string;source_author_name:string;body:string;original_created_at:string;saved_at:string};
export default function SavedMessagesPanel({onClose}:{onClose:()=>void}){
 const [rows,setRows]=useState<Saved[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const load=async()=>{setBusy(true);const {data,error}=await supabase.from('saved_messages').select('id,source_context,source_author_name,body,original_created_at,saved_at').order('saved_at',{ascending:false}).limit(200);if(error)setError(error.message);else{setError('');setRows((data||[]) as Saved[])}setBusy(false)};
 useEffect(()=>{void load()},[]);
 const remove=async(id:string)=>{const old=rows;setRows(v=>v.filter(x=>x.id!==id));const {error}=await supabase.from('saved_messages').delete().eq('id',id);if(error){setRows(old);setError(error.message)}};
 return <div className="feature-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="saved-messages-title" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><section className="feature-modal saved-messages-panel"><header><div><b id="saved-messages-title"><Bookmark size={18}/> Saved Messages</b><small>Private to your account. Saved text stays here after the chat message expires.</small></div><button onClick={onClose} aria-label="Close"><X size={18}/></button></header>{error&&<p className="feature-modal-error" role="alert">{error}</p>}{busy&&!rows.length?<p>Loading saved messages…</p>:rows.length?rows.map(row=><article className="saved-message-card" key={row.id}><div><b>{row.source_author_name}</b><small>{row.source_context} chat · saved {new Date(row.saved_at).toLocaleString()}</small><p>{row.body}</p></div><button type="button" onClick={()=>void remove(row.id)} aria-label="Remove saved message" title="Remove saved message"><Trash2 size={16}/></button></article>):<p className="feature-empty">No saved messages yet. Use a text message’s menu and choose “Save privately”.</p>}</section></div>
}
