import { Children, ReactNode, useEffect, useRef, useState } from 'react'
import { ChevronLeft } from 'lucide-react'
/** Only an arrow shows. Swipe it left and the tools slide out one by one; swipe right to hide them. Tapping does nothing. */
export default function HeaderTray({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false); const [settled, setSettled] = useState(false)
  const g = useRef({ x: 0, y: 0, on: false })
  useEffect(() => { if (!open) { setSettled(false); return } const t = window.setTimeout(() => setSettled(true), 520); return () => window.clearTimeout(t) }, [open])
  const start = (e: React.TouchEvent) => { const t = e.touches[0]; g.current = { x: t.clientX, y: t.clientY, on: true } }
  const move = (e: React.TouchEvent) => {
    if (!g.current.on) return; const t = e.touches[0]; const dx = t.clientX - g.current.x, dy = t.clientY - g.current.y
    if (Math.abs(dy) > Math.abs(dx) * 1.2) return
    if (dx < -22) { setOpen(true); g.current.on = false } else if (dx > 22) { setOpen(false); g.current.on = false }
  }
  const items = Children.toArray(children)
  return (<div className="flex items-center" onTouchStart={start} onTouchMove={move} onTouchEnd={() => { g.current.on = false }} style={{ touchAction: 'pan-y' }}>
    <div className={`flex items-center transition-all duration-500 ease-out ${open ? 'max-w-[270px]' : 'max-w-0'} ${settled ? '' : 'overflow-hidden'}`}>
      {items.map((c, i) => <span key={i} className={`flex transition-all duration-300 ease-out ${open ? 'translate-x-0 scale-100 opacity-100' : 'translate-x-8 scale-50 opacity-0'}`} style={{ transitionDelay: open ? `${(items.length - 1 - i) * 55}ms` : '0ms' }}>{c}</span>)}</div>
    <div aria-hidden className="grid h-11 w-10 place-items-center text-mute"><ChevronLeft size={22} className={`transition-transform duration-300 ${open ? 'rotate-180' : ''}`} /></div></div>)
}
