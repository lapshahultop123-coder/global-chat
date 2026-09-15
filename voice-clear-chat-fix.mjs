import fs from 'fs';

const file = 'src/App.tsx';
if (!fs.existsSync(file)) throw new Error(`Missing ${file}`);

let s = fs.readFileSync(file, 'utf8');

const old = `const clearChatLocally=()=>{const current=readLocalDeleted();const now=Date.now();messages.forEach(m=>{if(new Date(m.expires_at).getTime()>now)current[localMessageKey(m)]=new Date(m.expires_at).getTime()});persistLocalDeleted(current);setMessages([])};`;

const neu = `const clearChatLocally=()=>{const current=readLocalDeleted();const now=Date.now();messages.forEach(m=>{if(new Date(m.expires_at).getTime()>now)current[localMessageKey(m)]=new Date(m.expires_at).getTime()});persistLocalDeleted(current);setMessages([]);const voiceCurrent=readVoiceLocalDeleted();voiceMessages.forEach(v=>{if(new Date(v.expires_at).getTime()>now)voiceCurrent[v.id]=new Date(v.expires_at).getTime()});persistVoiceLocalDeleted(voiceCurrent);setVoiceLocalDeleted(voiceCurrent);setVoiceMessages([])};`;

if (!s.includes(old)) {
  throw new Error('Could not find the existing clearChatLocally function. No changes were made.');
}
if (s.includes(neu)) {
  console.log('Voice clear-chat fix is already applied.');
  process.exit(0);
}

s = s.replace(old, neu);
fs.writeFileSync(file, s, 'utf8');
console.log('Voice messages will now also be cleared by CLEAR CHAT.');
