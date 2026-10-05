import { useState, type ReactNode } from 'react';
import { ChevronUp } from 'lucide-react';

export default function ComposerToolsMenu({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return <div className="composer-tools-menu" onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
  }} onKeyDown={event => {
    if (event.key === 'Escape') setOpen(false);
  }}>
    <button type="button" className="composer-tools-trigger" aria-label="More message tools" title="More message tools" aria-expanded={open} onClick={() => setOpen(value => !value)}>
      <ChevronUp size={17}/>
    </button>
    {open && <div className="composer-tools-popover" role="group" aria-label="Message tools">{children}</div>}
  </div>;
}
