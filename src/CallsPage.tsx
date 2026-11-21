import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDownLeft, ArrowLeft, ArrowUpRight, Phone, Video } from 'lucide-react'
import { supabase } from './supabase'
import { useAuth } from './AuthContext'
import { Avatar } from './ui'
import { useCall } from './calls'
import { CallRow, describeCall } from './callLog'

type P = { id: string; username: string; full_name: string; avatar_url: string | null }
const dayName = (iso: string) => { const d = new Date(iso); const t = new Date(); const y = new Date(Date.now() - 864e5); return d.toDateString() === t.toDateString() ? 'Today' : d.toDateString() === y.toDateString() ? 'Yesterday' : d.toLocaleDateString([], { day: 'numeric', month: 'short' }) }

export default function CallsPage() {
  const { session } = useAuth(); const uid = session!.user.id; const { startCall } = useCall()
  const [rows, setRows] = useState<CallRow[] | null>(null); const [people, setPeople] = useState<Record<string, P>>({}); const [err, setErr] = useState('')
  useEffect(() => { (async () => {
    const { data, error } = await supabase.from('calls').select('*').or(`caller_id.eq.${uid},callee_id.eq.${uid}`).order('created_at', { ascending: false }).limit(80)
    if (error) { setErr(error.message); setRows([]); return }
    const list = (data ?? []) as CallRow[]; setRows(list)
    const ids = [...new Set(list.map(c => (c.caller_id === uid ? c.callee_id : c.caller_id)))]
    if (ids.length) { const { data: ps } = await supabase.from('profiles').select('id,username,full_name,avatar_url').in('id', ids); setPeople(Object.fromEntries(((ps ?? []) as P[]).map(p => [p.id, p]))) }
  })() }, [])
  return (<div className="flex flex-col gap-3 p-4">
    <div className="flex items-center gap-3"><Link to="/textora/menu" aria-label="Back" className="p-1"><ArrowLeft /></Link><h2 className="text-2xl font-black">Calls</h2></div>
    {err && <p className="rounded-xl bg-red-950 p-3 text-xs text-red-300">{err} (run the calls SQL in Supabase)</p>}
    {!rows && <p className="py-8 text-center text-mute">Loading…</p>}
    {rows && !rows.length && !err && <p className="py-8 text-center text-mute">No calls yet.</p>}
    <div className="divide-y divide-line overflow-hidden rounded-2xl bg-surface">{rows?.map(c => {
      const other = people[c.caller_id === uid ? c.callee_id : c.caller_id]; const d = describeCall(c, uid)
      return (<div key={c.id} className="flex items-center gap-3 px-4 py-3">
        {other ? <Avatar a={other} s={48} /> : <span className="h-12 w-12 rounded-full bg-bg" />}
        <div className="min-w-0 flex-1"><b className={`block truncate ${d.missed ? 'text-red-400' : ''}`}>{other?.full_name || other?.username || 'Unknown'}</b>
          <span className={`flex items-center gap-1 text-xs ${d.missed ? 'text-red-400' : 'text-mute'}`}>{d.outgoing ? <ArrowUpRight size={14} /> : <ArrowDownLeft size={14} />}{d.label}</span>
          <span className="text-xs text-mute">{dayName(c.created_at)}, {d.time}</span></div>
        <button disabled={!other} onClick={() => other && startCall(other, c.conversation_id ?? '', c.kind)} aria-label="Call back" className="rounded-full p-3 text-accent disabled:opacity-40">{c.kind === 'video' ? <Video size={22} /> : <Phone size={22} />}</button></div>)
    })}</div></div>)
}
