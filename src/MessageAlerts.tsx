import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabase'
import { useAuth } from './AuthContext'
import { Av } from './ui'
import { playNotify } from './sounds'
type W = { username: string; full_name: string; avatar_url: string | null }
// In-app toast for new messages while the app is open (push covers closed/background).
export default function MessageAlerts() {
  const { session } = useAuth(); const uid = session!.user.id; const nav = useNavigate()
  const [t, setT] = useState<{ who: W; chatId: string; text: string } | null>(null); const timer = useRef(0)
  useEffect(() => {
    const ch = supabase.channel('live-msg-' + uid)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async (p: any) => {
        const n = p.new; if (n.sender_id === uid) return
        window.dispatchEvent(new Event('textora-unread'))
        if (location.hash.includes('/textora/c/' + n.conversation_id)) return
        const mm = await supabase.from('conversation_members').select('muted').eq('conversation_id', n.conversation_id).eq('user_id', uid).maybeSingle()
        if (!mm.data || (mm.data as any).muted) return
        const w = (await supabase.from('profiles').select('username,full_name,avatar_url').eq('id', n.sender_id).single()).data as W | null
        if (!w) return
        playNotify()
        setT({ who: w, chatId: n.conversation_id, text: n.kind === 'image' ? 'sent a photo' : n.kind === 'voice' ? 'sent a voice message' : n.kind === 'video' ? 'sent a video' : n.kind === 'file' ? 'sent a file' : String(n.body ?? '').slice(0, 80) })
        window.clearTimeout(timer.current); timer.current = window.setTimeout(() => setT(null), 5000)
      }).subscribe()
    return () => { supabase.removeChannel(ch); window.clearTimeout(timer.current) }
  }, [uid])
  if (!t) return null
  return (<div onClick={() => { const id = t.chatId; setT(null); nav(`/textora/c/${id}`) }} className="pop-in fixed inset-x-3 z-[70] mx-auto flex max-w-xl cursor-pointer items-center gap-3 rounded-2xl border border-accent bg-surface p-3 text-ink shadow-xl" style={{ top: 'max(0.75rem, env(safe-area-inset-top))' }}>
    <Av a={t.who} /><p className="min-w-0 flex-1 truncate text-sm"><b>{t.who.full_name || t.who.username}</b> {t.text}</p></div>)
}
