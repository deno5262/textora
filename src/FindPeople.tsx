import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Search as SearchIcon } from 'lucide-react'
import { supabase } from './supabase'
import { useAuth } from './AuthContext'
import { Avatar } from './ui'
import { fetchFollowingIds, fetchFriendIds } from './textora'

type W = { id: string; username: string; full_name: string; avatar_url: string | null }
export default function FindPeople() {
  const { session } = useAuth(); const uid = session!.user.id
  const [q, setQ] = useState(''); const [res, setRes] = useState<W[] | null>(null); const [msg, setMsg] = useState('')
  const [fol, setFol] = useState<Set<string>>(new Set()); const [fr, setFr] = useState<Set<string>>(new Set()); const [pend, setPend] = useState<Set<string>>(new Set())
  useEffect(() => { (async () => {
    const [a, b, c] = await Promise.all([fetchFollowingIds(uid), fetchFriendIds(uid), supabase.from('friend_requests').select('receiver_id').eq('sender_id', uid).eq('status', 'pending')])
    setFol(a); setFr(b); setPend(new Set<string>(((c.data ?? []) as any[]).map(r => r.receiver_id as string)))
  })() }, [])
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
  const toggleFollow = async (id: string) => {
    const has = fol.has(id); if (has && !confirm('Unfollow this person?')) return
    const r = has ? await supabase.from('follows').delete().eq('follower_id', uid).eq('following_id', id) : await supabase.from('follows').insert({ follower_id: uid, following_id: id })
    if (r.error) return setMsg(r.error.message); const s = new Set(fol); if (has) s.delete(id); else s.add(id); setFol(s)
  }
  const addFriend = async (id: string) => { const r = await supabase.rpc('send_friend_request', { target: id }); if (r.error) return setMsg(r.error.message); setPend(new Set(pend).add(id)) }
  const small = 'rounded-full border border-line px-3 py-1 text-xs font-semibold'
  return (<div className="flex flex-col gap-3 p-4">
    <div className="flex items-center gap-3"><Link to="/textora/menu" aria-label="Back" className="p-1"><ArrowLeft /></Link><h2 className="text-2xl font-black">Find people</h2></div>
    <label className="flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2.5"><SearchIcon size={18} className="text-mute" /><input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Name, username or 8-digit ID" className="min-w-0 flex-1 bg-transparent outline-none" /></label>
    {msg && <p role="alert" className="text-sm text-red-400">{msg}</p>}
    {res && !res.length && <p className="py-8 text-center text-mute">No one found.</p>}
    {!res && <p className="py-8 text-center text-sm text-mute">Type at least 2 letters, or paste someone's ID from their profile.</p>}
    <div className="divide-y divide-line overflow-hidden rounded-2xl bg-surface empty:hidden">{res?.map(p => (
      <div key={p.id} className="flex items-center gap-3 px-4 py-3">
        <Link to={`/textora/u/${p.username}`} className="flex min-w-0 flex-1 items-center gap-3"><Avatar a={p} s={46} /><span className="min-w-0"><b className="block truncate">{p.full_name || p.username}</b><span className="block truncate text-xs text-mute">@{p.username}</span></span></Link>
        <button onClick={() => toggleFollow(p.id)} className={small}>{fol.has(p.id) ? 'Following' : 'Follow'}</button>
        {fr.has(p.id) ? <span className="text-xs text-mute">Friends</span> : pend.has(p.id) ? <span className="text-xs text-mute">Requested</span> : <button onClick={() => addFriend(p.id)} className={small}>Add friend</button>}</div>))}</div></div>)
}
