import { useEffect, useState } from 'react'
import { Check, Clock, Plus, UserCheck, X } from 'lucide-react'
import { supabase } from './supabase'
import { useAuth } from './AuthContext'

export type Fr = { kind: 'none' | 'friends' | 'sent' | 'received'; id?: string }
/** Friend-request state with one person, plus the actions. */
export function useFriendState(target: string | undefined) {
  const { session } = useAuth(); const uid = session!.user.id
  const [fr, setFr] = useState<Fr>({ kind: 'none' }); const [busy, setBusy] = useState(false); const [msg, setMsg] = useState('')
  const load = async () => {
    if (!target) return; const [a, b] = uid < target ? [uid, target] : [target, uid]
    const [fs, rq] = await Promise.all([
      supabase.from('friendships').select('user_a').eq('user_a', a).eq('user_b', b).maybeSingle(),
      supabase.from('friend_requests').select('id,sender_id').eq('status', 'pending').or(`and(sender_id.eq.${uid},receiver_id.eq.${target}),and(sender_id.eq.${target},receiver_id.eq.${uid})`).maybeSingle()])
    const q: any = rq.data; setFr(fs.data ? { kind: 'friends' } : q ? { kind: q.sender_id === uid ? 'sent' : 'received', id: q.id } : { kind: 'none' })
  }
  useEffect(() => { load() }, [target])
  const run = async (fn: () => PromiseLike<any>) => { setBusy(true); setMsg(''); const r = await fn(); if (r?.error) setMsg(r.error.message); await load(); setBusy(false) }
  return { fr, busy, msg, reload: load,
    send: () => run(() => supabase.rpc('send_friend_request', { target })),
    cancel: () => run(() => supabase.rpc('cancel_friend_request', { req: fr.id })),
    accept: () => run(() => supabase.rpc('respond_friend_request', { req: fr.id, accept: true })),
    decline: () => run(() => supabase.rpc('respond_friend_request', { req: fr.id, accept: false })),
    unfriend: () => { if (confirm('Remove this friend?')) run(() => supabase.rpc('remove_friend', { other: target })) } }
}

/** The round icon: + (send request) · clock (request sent, tap to cancel) · tick/cross (answer a request) · friends icon. */
export function FriendPlus({ f, size = 34 }: { f: ReturnType<typeof useFriendState>; size?: number }) {
  const base = 'grid shrink-0 place-items-center rounded-full border-2 border-bg disabled:opacity-60'; const st = { width: size, height: size }; const ic = Math.round(size * 0.52)
  if (f.fr.kind === 'friends') return <button disabled={f.busy} onClick={f.unfriend} aria-label="Friends" title="Friends" style={st} className={`${base} bg-green-600 text-white`}><UserCheck size={ic} /></button>
  if (f.fr.kind === 'sent') return <button disabled={f.busy} onClick={f.cancel} aria-label="Cancel friend request" title="Request sent. Tap to cancel" style={st} className={`${base} bg-surface text-mute`}><Clock size={ic} /></button>
  if (f.fr.kind === 'received') return <span className="flex gap-1"><button disabled={f.busy} onClick={f.accept} aria-label="Accept" style={st} className={`${base} bg-green-600 text-white`}><Check size={ic} /></button><button disabled={f.busy} onClick={f.decline} aria-label="Decline" style={st} className={`${base} bg-red-600 text-white`}><X size={ic} /></button></span>
  return <button disabled={f.busy} onClick={f.send} aria-label="Send friend request" title="Add friend" style={st} className={`${base} bg-accent text-on`}><Plus size={ic + 2} /></button>
}
