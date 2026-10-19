import { useState, type ReactNode } from 'react';
import { ChevronUp, Eye, EyeOff } from 'lucide-react';

export default function ComposerToolsMenu({ children, privacyShield, onTogglePrivacyShield }: { children: ReactNode; privacyShield?: boolean; onTogglePrivacyShield?: () => void }) {
  const [open, setOpen] = useState(false);

  return <div className="composer-tools-menu" onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
  }} onKeyDown={event => {
    if (event.key === 'Escape') setOpen(false);
  }}>
    <button type="button" className="composer-tools-trigger" aria-label="More message tools" title="More message tools" aria-expanded={open} onClick={() => setOpen(value => !value)}>
      <ChevronUp size={17}/>
    </button>
    {open && <div className="composer-tools-popover" role="group" aria-label="Message tools">{children}{privacyShield!==undefined&&onTogglePrivacyShield&&<button type="button" className={`composer-tool-action privacy-shield-tool${privacyShield?' is-active':''}`} aria-pressed={privacyShield} onClick={onTogglePrivacyShield} aria-label={privacyShield?'Turn off Privacy Shield':'Turn on Privacy Shield'} title={privacyShield?'Privacy Shield on · Turn off':'Privacy Shield off · Turn on'}>{privacyShield?<EyeOff size={18}/>:<Eye size={18}/>}</button>}</div>}
  </div>;
}
