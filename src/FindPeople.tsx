import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Search as SearchIcon } from 'lucide-react'
import { supabase } from './supabase'
import { useAuth } from './AuthContext'
import { Avatar } from './ui'
import { fetchFriendIds } from './textora'
import { Check, Clock, Plus, UserCheck, X } from 'lucide-react'

type W = { id: string; username: string; full_name: string; avatar_url: string | null }
export default function FindPeople() {
  const { session } = useAuth(); const uid = session!.user.id
  const [q, setQ] = useState(''); const [res, setRes] = useState<W[] | null>(null); const [msg, setMsg] = useState('')
  const [fr, setFr] = useState<Set<string>>(new Set()); const [sent, setSent] = useState<Record<string, string>>({}); const [recv, setRecv] = useState<Record<string, string>>({})
  const loadRel = async () => {
    const [b, c] = await Promise.all([fetchFriendIds(uid), supabase.from('friend_requests').select('id,sender_id,receiver_id').eq('status', 'pending').or(`sender_id.eq.${uid},receiver_id.eq.${uid}`)])
    setFr(b); const s: Record<string, string> = {}, r: Record<string, string> = {}
    ;((c.data ?? []) as any[]).forEach(x => { if (x.sender_id === uid) s[x.receiver_id] = x.id; else r[x.sender_id] = x.id })
    setSent(s); setRecv(r)
  }
  useEffect(() => { loadRel() }, [])
  useEffect(() => {
    const t = q.trim().replace(/[%,()]/g, ''); if (t.length < 2) { setRes(null); return }
    const id = window.setTimeout(async () => {
      const ids = new Set<string>(); const list: W[] = []
      if (/^\d{6,12}$/.test(t)) { const { data } = await supabase.from('user_stats').select('user_id').eq('public_id', t); (data ?? []).forEach((r: any) => ids.add(r.user_id)) }
      const [byName, byId] = await Promise.all([
        supabase.from('profiles').select('id,username,full_name,avatar_url').or(`username.ilike.%${t}%,full_name.ilike.%${t}%`).limit(20),
        ids.size ? supabase.from('profiles').select('id,username,full_name,avatar_url').in('id', [...ids]) : Promise.resolve({ data: [] as any[] })])
      const seen = new Set<string>(); for (const p of [...((byId.data ?? []) as W[]), ...((byName.data ?? []) as W[])]) if (p.id !== uid && !seen.has(p.id)) { seen.add(p.id); list.push(p) }
      setRes(list)
    }, 350)
    return () => window.clearTimeout(id)
  }, [q])
  const act = async (fn: () => PromiseLike<any>) => { setMsg(''); const r = await fn(); if (r?.error) setMsg(r.error.message); await loadRel() }
  const ic = 'grid h-9 w-9 shrink-0 place-items-center rounded-full disabled:opacity-60'
  return (<div className="flex flex-col gap-3 p-4">
    <div className="flex items-center gap-3"><Link to="/textora/menu" aria-label="Back" className="p-1"><ArrowLeft /></Link><h2 className="text-2xl font-black">Find people</h2></div>
    <label className="flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2.5"><SearchIcon size={18} className="text-mute" /><input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Name, username or 8-digit ID" className="min-w-0 flex-1 bg-transparent outline-none" /></label>
    {msg && <p role="alert" className="text-sm text-red-400">{msg}</p>}
    {res && !res.length && <p className="py-8 text-center text-mute">No one found.</p>}
    {!res && <p className="py-8 text-center text-sm text-mute">Type at least 2 letters, or paste someone's ID from their profile.</p>}
    <div className="divide-y divide-line overflow-hidden rounded-2xl bg-surface empty:hidden">{res?.map(p => (
      <div key={p.id} className="flex items-center gap-3 px-4 py-3">
        <Link to={`/textora/u/${p.username}`} className="flex min-w-0 flex-1 items-center gap-3"><Avatar a={p} s={46} /><span className="min-w-0"><b className="block truncate">{p.full_name || p.username}</b><span className="block truncate text-xs text-mute">@{p.username}</span></span></Link>
        {fr.has(p.id) ? <span className={`${ic} bg-green-600 text-white`} title="Friends"><UserCheck size={18} /></span>
          : sent[p.id] ? <button onClick={() => act(() => supabase.rpc('cancel_friend_request', { req: sent[p.id] }))} aria-label="Cancel request" title="Request sent. Tap to cancel" className={`${ic} bg-bg text-mute`}><Clock size={18} /></button>
          : recv[p.id] ? <span className="flex gap-1"><button onClick={() => act(() => supabase.rpc('respond_friend_request', { req: recv[p.id], accept: true }))} aria-label="Accept" className={`${ic} bg-green-600 text-white`}><Check size={18} /></button><button onClick={() => act(() => supabase.rpc('respond_friend_request', { req: recv[p.id], accept: false }))} aria-label="Decline" className={`${ic} bg-red-600 text-white`}><X size={18} /></button></span>
          : <button onClick={() => act(() => supabase.rpc('send_friend_request', { target: p.id }))} aria-label="Send friend request" title="Add friend" className={`${ic} bg-accent text-on`}><Plus size={20} /></button>}</div>))}</div></div>)
}
