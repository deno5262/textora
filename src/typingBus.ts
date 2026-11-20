import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { playTyping } from './sounds'

// Lightweight "X is typing" signal sent straight to the other person (works even when they are on the chat list).
const last: Record<string, number> = {}
const subs = new Set<() => void>()
const out = new Map<string, any>()
const FRESH = 4500
export const typingFresh = (cid: string) => Date.now() - (last[cid] ?? 0) < FRESH
const ping = () => subs.forEach(f => f())

export function sendTypingTo(otherId: string, cid: string, uid: string) {
  let ch = out.get(otherId)
  if (!ch) { ch = supabase.channel('typing-to-' + otherId); ch.subscribe(); out.set(otherId, ch) }
  ch.send({ type: 'broadcast', event: 'typing', payload: { cid, uid } })
}

export function useTypingListener(uid: string | undefined) {
  useEffect(() => {
    if (!uid) return
    const ch = supabase.channel('typing-to-' + uid).on('broadcast', { event: 'typing' }, (p: any) => {
      const cid = p.payload?.cid; if (!cid) return
      const first = !typingFresh(cid); last[cid] = Date.now(); ping()
      if (first && !location.hash.includes('/textora/c/' + cid)) playTyping()
      window.setTimeout(ping, FRESH + 100)
    }).subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [uid])
}
export function useTypingTick() {
  const [, f] = useState(0)
  useEffect(() => { const l = () => f(x => x + 1); subs.add(l); return () => { subs.delete(l) } }, [])
}
