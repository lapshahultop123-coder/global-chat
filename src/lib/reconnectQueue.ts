export type ChatTextContext='public'|'private'|'friend';
export type QueuedChatText={id:string;context:ChatTextContext;targetId:string|null;body:string;replyToId?:string|null;userId:string;createdAt:string;status:'queued'|'sending'|'failed';error?:string};
const key=(userId:string)=>`zynyro-reconnect-queue-v1:${userId}`;
export function readReconnectQueue(userId:string):QueuedChatText[]{try{const value=JSON.parse(localStorage.getItem(key(userId))||'[]');return Array.isArray(value)?value.filter((x:any)=>x&&x.userId===userId&&typeof x.body==='string').map((x:any)=>x.status==='sending'?{...x,status:'queued'}:x):[]}catch{return[]}}
export function writeReconnectQueue(userId:string,items:QueuedChatText[]){try{localStorage.setItem(key(userId),JSON.stringify(items))}catch{}}
