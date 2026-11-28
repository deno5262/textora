import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Menu as MenuIcon, MessageCircle, Mic, Radio, Users } from 'lucide-react'
import { supabase } from './supabase'
import { useAuth } from './AuthContext'
import { Avatar } from './ui'
import { useBackClose } from './useBackClose'

type Room = { id: string; host_id: string; title: string; seat_count: number; mode: string; started_at: string }
type P = { id: string; username: string; full_name: string; avatar_url: string | null }
export default function LiveHome() {
  const { session } = useAuth(); const uid = session!.user.id; const nav = useNavigate()
  const [rooms, setRooms] = useState<Room[] | null>(null); const [hosts, setHosts] = useState<Record<string, P>>({}); const [used, setUsed] = useState<Record<string, number>>({})
  const [chk, setChk] = useState(''); const check = async () => { setChk('Checking…'); const { data, error } = await supabase.functions.invoke('live', { body: { action: 'check' } }); if (error) { let m = error.message; try { const j = await (error as any).context?.json(); if (j?.error) m = j.error } catch { /* ignore */ } return setChk('Failed: ' + m) } const d: any = data; setChk(d.ok ? `Voice server OK (${d.server})` : `Voice server refused the keys (HTTP ${d.status}). Key starts with “${d.key_starts_with}”, key length ${d.key_length}, secret length ${d.secret_length}. ${d.detail}`) }
  const [open, setOpen] = useState(false); const [title, setTitle] = useState(''); const [seats, setSeats] = useState(8); const [mode, setMode] = useState<'request' | 'open'>('request'); const [busy, setBusy] = useState(false); const [err, setErr] = useState('')
  useBackClose(open, () => setOpen(false))
  const load = async () => {
    const { data, error } = await supabase.from('live_rooms').select('*').eq('status', 'live').gt('last_beat', new Date(Date.now() - 120000).toISOString()).order('started_at', { ascending: false }).limit(40)
    if (error) { setErr(error.message); setRooms([]); return }
    const list = (data ?? []) as Room[]; setRooms(list)
    const ids = list.map(r => r.id)
    if (ids.length) {
      const [ps, ss] = await Promise.all([supabase.from('profiles').select('id,username,full_name,avatar_url').in('id', [...new Set(list.map(r => r.host_id))]), supabase.from('live_seats').select('room_id').in('room_id', ids).not('user_id', 'is', null)])
      setHosts(Object.fromEntries(((ps.data ?? []) as P[]).map(p => [p.id, p])))
      const c: Record<string, number> = {}; ((ss.data ?? []) as any[]).forEach(s => { c[s.room_id] = (c[s.room_id] ?? 0) + 1 }); setUsed(c)
    }
  }
  useEffect(() => {
    load(); const ch = supabase.channel('live-home').on('postgres_changes', { event: '*', schema: 'public', table: 'live_rooms' }, load).subscribe(); const i = window.setInterval(load, 20000)
    return () => { supabase.removeChannel(ch); window.clearInterval(i) }
  }, [])
  const create = async () => {
    setErr(''); setBusy(true)
    const { data, error } = await supabase.rpc('live_create', { p_title: title.trim(), p_seats: seats, p_mode: mode })
    setBusy(false); if (error) return setErr(error.message); nav(`/textora/live/${data}`)
  }
  return (<div className="flex flex-col gap-4 p-4 pb-24">
    <div className="flex items-center gap-3"><Link to="/textora/menu" aria-label="Back" className="p-1"><ArrowLeft /></Link><h2 className="flex-1 text-2xl font-black">Live</h2>
      <button onClick={() => setOpen(true)} className="flex items-center gap-2 rounded-full bg-red-600 px-4 py-2 font-bold text-white"><Radio size={18} />Go live</button></div>
    {err && !open && <p role="alert" className="rounded-xl bg-red-950 p-3 text-xs text-red-300">{err} (run the live SQL in Supabase)</p>}
    {!rooms && <p className="py-10 text-center text-mute">Loading…</p>}
    {rooms && !rooms.length && !err && <div className="py-12 text-center text-mute"><Radio className="mx-auto mb-2" size={36} />No one is live right now.<br />Be the first, tap “Go live”.</div>}
    <div className="grid grid-cols-2 gap-3">{rooms?.map(r => { const h = hosts[r.host_id]; return (
      <Link key={r.id} to={`/textora/live/${r.id}`} className="relative flex flex-col items-center gap-2 overflow-hidden rounded-3xl border border-line bg-surface p-4 text-center" style={{ background: 'linear-gradient(160deg, var(--surface), var(--bg))' }}>
        <span className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />LIVE</span>
        {h ? <Avatar a={h} s={72} /> : <span className="h-[72px] w-[72px] rounded-full bg-bg" />}
        <b className="w-full truncate">{r.title}</b><span className="w-full truncate text-xs text-mute">{h?.full_name || h?.username || 'Host'}</span>
        <span className="flex items-center gap-3 text-xs text-mute"><span className="flex items-center gap-1"><Mic size={13} />{used[r.id] ?? 1}/{r.seat_count}</span>{r.host_id === uid && <span className="flex items-center gap-1 text-accent"><Users size={13} />You</span>}</span></Link>) })}</div>

    <div className="text-center"><button onClick={check} className="text-xs text-mute underline">Check the voice server</button>{chk && <p className="mt-1 break-words text-xs text-mute">{chk}</p>}</div>
    {open && <div className="fixed inset-0 z-50 flex items-end bg-black/60" onClick={() => setOpen(false)}>
      <div onClick={e => e.stopPropagation()} className="w-full rounded-t-3xl bg-surface p-5" style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}>
        <b className="mb-3 block text-lg">Start a live</b>
        <input className="input mb-3 w-full" maxLength={60} placeholder="Title (what is this live about?)" value={title} onChange={e => setTitle(e.target.value)} />
        <p className="mb-1 text-xs text-mute">Seats on the board (including yours)</p>
        <div className="mb-3 flex gap-2">{[4, 6, 8, 9, 12].map(n => <button key={n} onClick={() => setSeats(n)} className={`flex-1 rounded-xl border py-2 font-semibold ${seats === n ? 'border-accent text-accent' : 'border-line'}`}>{n}</button>)}</div>
        <p className="mb-1 text-xs text-mute">Who can take a seat</p>
        <div className="mb-4 flex gap-2">
          <button onClick={() => setMode('request')} className={`flex-1 rounded-xl border p-2 text-sm ${mode === 'request' ? 'border-accent text-accent' : 'border-line'}`}>I approve first</button>
          <button onClick={() => setMode('open')} className={`flex-1 rounded-xl border p-2 text-sm ${mode === 'open' ? 'border-accent text-accent' : 'border-line'}`}>Anyone, instantly</button></div>
        {err && <p role="alert" className="mb-2 text-sm text-red-400">{err}</p>}
        <button disabled={busy || !title.trim()} onClick={create} className="w-full rounded-xl bg-red-600 py-3 font-bold text-white disabled:opacity-50">{busy ? 'Starting…' : 'Go live'}</button></div></div>}
    <nav className="fixed inset-x-0 bottom-0 z-20 mx-auto flex max-w-xl border-t border-line bg-bg" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {([['/textora', MessageCircle, 'Chats', false], ['/textora/people', Users, 'People', false], ['/textora/live', Radio, 'Live', true], ['/textora/menu', MenuIcon, 'Menu', false]] as const).map(([to, I, l, on]) => <Link key={l} to={to} className="flex flex-1 flex-col items-center gap-0.5 py-2 text-xs" style={{ color: on ? 'var(--accent)' : 'var(--mute)' }}><I size={24} />{l}</Link>)}</nav>
  </div>)
}
