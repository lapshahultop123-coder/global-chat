import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, X } from 'lucide-react';

type Props={
  title:string;
  message:string;
  confirmLabel:string;
  cancelLabel?:string;
  tone?:'danger'|'accent';
  icon?:ReactNode;
  busy?:boolean;
  busyLabel?:string;
  onConfirm:()=>void|Promise<void>;
  onCancel:()=>void;
  onError?:(error:unknown)=>void;
};

export default function ActionDialog({title,message,confirmLabel,cancelLabel='Cancel',tone='danger',icon,busy=false,busyLabel='Please wait…',onConfirm,onCancel,onError}:Props){
  const titleId=useId();
  const messageId=useId();
  const dialogRef=useRef<HTMLDivElement>(null);
  const [submitting,setSubmitting]=useState(false);
  const isBusy=busy||submitting;

  useEffect(()=>{
    const previous=document.activeElement instanceof HTMLElement?document.activeElement:null;
    const target=dialogRef.current?.querySelector<HTMLElement>('[data-dialog-cancel]')||dialogRef.current?.querySelector<HTMLElement>('[data-dialog-confirm]');
    target?.focus();
    return()=>{if(previous?.isConnected)previous.focus()};
  },[]);

  const confirm=async()=>{
    if(isBusy)return;
    setSubmitting(true);
    try{await onConfirm()}catch(error){onError?.(error)}finally{setSubmitting(false)}
  };

  const onDialogKeyDown=(event:React.KeyboardEvent<HTMLDivElement>)=>{
    if(event.key==='Escape'){
      event.preventDefault();
      if(!isBusy)onCancel();
      return;
    }
    if(event.key!=='Tab')return;
    const items=dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled)');
    if(!items?.length)return;
    const first=items[0],last=items[items.length-1];
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
  };

  return <div className="app-action-dialog-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget&&!isBusy)onCancel()}}>
    <div className={`app-action-dialog ${tone}`} ref={dialogRef} role="alertdialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={messageId} onKeyDown={onDialogKeyDown}>
      <div className="app-action-dialog-heading">
        <span className="app-action-dialog-icon">{icon||<AlertTriangle size={22}/>}</span>
        <button type="button" className="app-action-dialog-close" onClick={onCancel} disabled={isBusy} aria-label="Close dialog"><X size={18}/></button>
      </div>
      <h2 id={titleId}>{title}</h2>
      <p id={messageId}>{message}</p>
      <div className="app-action-dialog-actions">
        {cancelLabel&&<button type="button" className="app-action-dialog-cancel" data-dialog-cancel onClick={onCancel} disabled={isBusy}>{cancelLabel}</button>}
        <button type="button" className="app-action-dialog-confirm" data-dialog-confirm onClick={()=>void confirm()} disabled={isBusy}>{isBusy?busyLabel:confirmLabel}</button>
      </div>
    </div>
  </div>;
}
