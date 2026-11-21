import { useEffect, useRef, useState } from 'react'
import { Check, Crop, Pencil, RotateCw, Undo2, X } from 'lucide-react'

type Stroke = { c: string; w: number; pts: [number, number][] }
const COLORS = ['#ffffff', '#ff3b30', '#ffcc00', '#34c759', '#0a84ff', '#000000']
const MAX = 1800

/** Small photo editor: draw/mark, crop and rotate, then send as a photo or as an original document. */
export default function ImageEditor({ file, onCancel, onDone }: { file: File; onCancel: () => void; onDone: (f: File, asDoc: boolean) => void }) {
  const view = useRef<HTMLCanvasElement>(null); const base = useRef<HTMLCanvasElement | null>(null); const strokes = useRef<Stroke[]>([])
  const [mode, setMode] = useState<'draw' | 'crop'>('draw'); const [color, setColor] = useState(COLORS[1]); const [tick, setTick] = useState(0)
  const [crop, setCrop] = useState<{ x: number; y: number; w: number; h: number } | null>(null); const drag = useRef<{ x: number; y: number } | null>(null); const cur = useRef<Stroke | null>(null)
  const [ready, setReady] = useState(false)

  const redraw = () => {
    const v = view.current, b = base.current; if (!v || !b) return
    v.width = b.width; v.height = b.height; const ctx = v.getContext('2d')!; ctx.drawImage(b, 0, 0)
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'
    for (const s of [...strokes.current, ...(cur.current ? [cur.current] : [])]) { ctx.strokeStyle = s.c; ctx.lineWidth = s.w; ctx.beginPath(); s.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); if (s.pts.length === 1) ctx.lineTo(s.pts[0][0] + 0.1, s.pts[0][1]); ctx.stroke() }
  }
  useEffect(() => {
    let dead = false; const url = URL.createObjectURL(file); const img = new Image()
    img.onload = () => { if (dead) return; const k = Math.min(1, MAX / Math.max(img.width, img.height)); const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height); base.current = c; setReady(true); URL.revokeObjectURL(url) }
    img.onerror = () => { URL.revokeObjectURL(url); onCancel() }; img.src = url
    return () => { dead = true }
  }, [file])
  useEffect(() => { if (ready) redraw() }, [ready, tick, mode])

  const bake = () => { const b = base.current; if (!b) return; const v = view.current!; redraw(); const c = document.createElement('canvas'); c.width = v.width; c.height = v.height; c.getContext('2d')!.drawImage(v, 0, 0); base.current = c; strokes.current = [] }
  const pos = (e: React.PointerEvent): [number, number] => { const r = view.current!.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * view.current!.width, ((e.clientY - r.top) / r.height) * view.current!.height] }
  const down = (e: React.PointerEvent) => {
    if (!ready) return; (e.target as HTMLElement).setPointerCapture?.(e.pointerId); const [x, y] = pos(e)
    if (mode === 'draw') cur.current = { c: color, w: Math.max(4, view.current!.width / 120), pts: [[x, y]] }
    else { drag.current = { x, y }; setCrop({ x, y, w: 0, h: 0 }) }
    setTick(t => t + 1)
  }
  const move = (e: React.PointerEvent) => {
    const [x, y] = pos(e)
    if (mode === 'draw' && cur.current) { cur.current.pts.push([x, y]); redraw() }
    else if (mode === 'crop' && drag.current) { const d = drag.current; setCrop({ x: Math.min(d.x, x), y: Math.min(d.y, y), w: Math.abs(x - d.x), h: Math.abs(y - d.y) }) }
  }
  const up = () => { if (cur.current) { strokes.current.push(cur.current); cur.current = null; setTick(t => t + 1) } drag.current = null }
  const undo = () => { strokes.current.pop(); setTick(t => t + 1) }
  const rotate = () => { bake(); const b = base.current!; const c = document.createElement('canvas'); c.width = b.height; c.height = b.width; const x = c.getContext('2d')!; x.translate(c.width, 0); x.rotate(Math.PI / 2); x.drawImage(b, 0, 0); base.current = c; setCrop(null); setTick(t => t + 1) }
  const applyCrop = () => {
    if (!crop || crop.w < 20 || crop.h < 20) return setCrop(null); bake(); const b = base.current!
    const c = document.createElement('canvas'); c.width = Math.round(crop.w); c.height = Math.round(crop.h); c.getContext('2d')!.drawImage(b, crop.x, crop.y, crop.w, crop.h, 0, 0, c.width, c.height); base.current = c; setCrop(null); setMode('draw'); setTick(t => t + 1)
  }
  const finish = async (asDoc: boolean) => {
    if (asDoc && !strokes.current.length && !crop && base.current && tick === 0) { onDone(file, true); return }   // untouched original
    bake(); const b = base.current!
    b.toBlob(bl => { if (bl) onDone(new File([bl], (file.name.replace(/\.[^.]+$/, '') || 'photo') + '.jpg', { type: 'image/jpeg' }), asDoc) }, 'image/jpeg', 0.92)
  }
  const r = view.current?.getBoundingClientRect(); const sx = r && view.current ? r.width / view.current.width : 1
  return (<div className="fixed inset-0 z-[85] flex flex-col bg-black text-white" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
    <div className="flex items-center justify-between p-2">
      <button onClick={onCancel} aria-label="Cancel" className="p-3"><X /></button>
      <div className="flex items-center gap-1">
        <button onClick={() => { setMode('draw'); setCrop(null) }} aria-label="Draw" className={`rounded-full p-3 ${mode === 'draw' ? 'bg-white/20' : ''}`}><Pencil size={20} /></button>
        <button onClick={() => setMode('crop')} aria-label="Crop" className={`rounded-full p-3 ${mode === 'crop' ? 'bg-white/20' : ''}`}><Crop size={20} /></button>
        <button onClick={rotate} aria-label="Rotate" className="rounded-full p-3"><RotateCw size={20} /></button>
        <button onClick={undo} aria-label="Undo" className="rounded-full p-3"><Undo2 size={20} /></button></div>
      <span className="w-12" /></div>
    <div className="relative flex min-h-0 flex-1 items-center justify-center p-2">
      {!ready && <span className="text-white/70">Loading…</span>}
      <div className="relative inline-block max-h-full max-w-full">
        <canvas ref={view} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} className="block max-h-[68vh] max-w-full rounded-lg" style={{ touchAction: 'none' }} />
        {mode === 'crop' && crop && crop.w > 0 && <div className="pointer-events-none absolute border-2 border-white" style={{ left: crop.x * sx, top: crop.y * sx, width: crop.w * sx, height: crop.h * sx, boxShadow: '0 0 0 9999px rgba(0,0,0,.55)' }} />}</div></div>
    {mode === 'draw' && <div className="flex items-center justify-center gap-3 py-2">{COLORS.map(c => <button key={c} aria-label={c} onClick={() => setColor(c)} className="h-8 w-8 rounded-full border-2" style={{ background: c, borderColor: color === c ? '#fff' : 'rgba(255,255,255,.3)', transform: color === c ? 'scale(1.2)' : undefined }} />)}</div>}
    {mode === 'crop' && <div className="flex items-center justify-center gap-3 py-2 text-sm"><span className="text-white/70">Drag on the photo to choose the area</span><button onClick={applyCrop} className="rounded-full bg-white/20 px-4 py-1.5">Apply crop</button></div>}
    <div className="flex items-center justify-between gap-3 p-3" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
      <button onClick={() => finish(true)} className="rounded-full border border-white/40 px-4 py-2.5 text-sm">Send as document</button>
      <button onClick={() => finish(false)} className="flex items-center gap-2 rounded-full bg-[var(--accent)] px-6 py-2.5 font-semibold text-[var(--on)]"><Check size={18} />Send</button></div></div>)
}
