import { ReactNode, useEffect, useState } from 'react'
import { ChevronLeft } from 'lucide-react'
/** A small arrow that slides a row of tools out like a shutter (call, video, theme, search). */
export default function HeaderTray({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false); const [settled, setSettled] = useState(false)
  useEffect(() => { if (!open) { setSettled(false); return } const t = window.setTimeout(() => setSettled(true), 300); return () => window.clearTimeout(t) }, [open])
  return (<div className="flex items-center">
    <div className={`flex items-center transition-all duration-300 ease-out ${open ? 'max-w-[280px] opacity-100' : 'max-w-0 opacity-0'} ${settled ? '' : 'overflow-hidden'}`}>{children}</div>
    <button onClick={() => setOpen(o => !o)} aria-label={open ? 'Hide tools' : 'Show tools'} className="grid h-9 w-7 place-items-center text-mute"><ChevronLeft size={22} className={`transition-transform duration-300 ${open ? 'rotate-180' : ''}`} /></button></div>)
}
