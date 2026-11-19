import { useEffect, useState } from 'react'
import { supabase, THEMES, THEME_COLORS } from './supabase'
import { useAuth } from './AuthContext'
import { playNotify } from './sounds'
import { usePushStatus, setupPush } from './push'
export function BlockedList() {
  const { session } = useAuth(); const uid = session!.user.id; const [list, setList] = useState<any[] | null>(null)
  const load = () => supabase.from('blocks').select('blocked_id,who:profiles!blocks_blocked_id_fkey(id,username,full_name,avatar_url)').eq('blocker_id', uid).then(({ data }) => setList(data ?? []))
  useEffect(() => { load() }, [])
  const unblock = async (id: string) => { await supabase.from('blocks').delete().eq('blocker_id', uid).eq('blocked_id', id); load() }
  return (<section className="flex flex-col gap-2"><h2 className="font-bold">Blocked users</h2>
    {!list && <p className="text-mute">Loading…</p>}{list && !list.length && <p className="text-sm text-mute">You haven't blocked anyone.</p>}
    {list?.map(b => <div key={b.blocked_id} className="flex items-center justify-between gap-3 rounded-xl border border-line p-3"><span className="min-w-0 truncate"><b>{b.who.full_name || b.who.username}</b> <span className="text-sm text-mute">@{b.who.username}</span></span><button onClick={() => unblock(b.blocked_id)} className="rounded-full border border-line px-3 py-1 text-sm">Unblock</button></div>)}
    <p className="text-sm text-mute">Blocked people can't message you, and their posts are hidden from you.</p></section>)
}
export function TypingAnother() {
  const { profile, refresh } = useAuth()
  const set = async (k: string, v: string | boolean) => { await supabase.from('profiles').update({ [k]: v }).eq('id', profile!.id); refresh() }
  const on = !!profile?.typing_status_enabled; const showName = !!profile?.typing_show_name; const vis = profile?.typing_visibility ?? 'friends'
  const preview = !on || vis === 'private' ? 'Hidden. Nobody sees that you are in a chat.' : showName ? 'Chat typing with Anik   (only if Anik allows it)' : 'Chat with another'
  const row = 'flex items-center justify-between gap-3 rounded-xl border border-line p-3'
  return (<section className="flex flex-col gap-2"><h2 className="font-bold">Typing Another</h2>
    <label className={row}><span>Show a status while I'm typing in a chat<small className="block text-mute">Others can see that you are busy typing. Never the message itself.</small></span><input type="checkbox" checked={on} onChange={e => set('typing_status_enabled', e.target.checked)} /></label>
    <label className={row}><span>Show who I'm chatting with<small className="block text-mute">Off shows "Chat with another".</small></span><input type="checkbox" checked={showName} onChange={e => set('typing_show_name', e.target.checked)} /></label>
    <label className={row}><span>Who can see it</span><select className="rounded-lg border border-line bg-bg px-2 py-1" value={vis} onChange={e => set('typing_visibility', e.target.value)}><option value="everyone">Everyone</option><option value="friends">Friends</option><option value="private">Private</option></select></label>
    <label className={row}><span>Allow my name in other people's status<small className="block text-mute">Without this, you are never named.</small></span><input type="checkbox" checked={!!profile?.typing_name_consent} onChange={e => set('typing_name_consent', e.target.checked)} /></label>
    <p className="rounded-xl bg-surface p-3 text-sm"><span className="text-mute">Preview: </span><b>{preview}</b></p></section>)
}
function PushStatusCard() {
  const { profile } = useAuth(); const s = usePushStatus()
  const line = (k: string, v: string, ok?: boolean) => <p className="flex justify-between gap-3 text-sm"><span className="text-mute">{k}</span><span className={ok === undefined ? '' : ok ? 'text-green-400' : 'text-red-400'}>{v}</span></p>
  return (<section className="flex flex-col gap-2 rounded-xl border border-line p-3"><h2 className="font-bold">Notification status</h2>
    {line('Android app', s.native ? 'yes' : 'no', s.native)}{line('Push in this build', s.flag ? 'ON' : 'OFF', s.flag)}{line('Permission', s.perm, s.perm === 'granted')}{line('Device token', s.token, s.token !== '-')}{line('Saved to server', s.saved, s.saved.startsWith('saved'))}
    {s.error && <p className="rounded-lg bg-red-950 p-2 text-xs text-red-300">{s.error}</p>}
    <button onClick={() => profile && setupPush(profile.id, true)} className="mt-1 rounded-xl bg-accent px-4 py-2 font-semibold text-on">Retry</button></section>)
}
function ExtraPrefs() {
  const { theme, setTheme } = useAuth()
  return (<section className="flex flex-col gap-2"><h2 className="font-bold">App theme</h2>
    <div className="grid grid-cols-2 gap-2">{THEMES.map(([k, name]) => (
      <button key={k} onClick={() => setTheme(k)} className={`flex items-center justify-between gap-2 rounded-xl border p-3 text-left text-sm ${theme === k ? 'border-accent text-accent' : 'border-line'}`}>
        <span className="truncate">{name}</span>
        <span className="flex shrink-0 gap-1">{(THEME_COLORS[k] ?? []).map((c, i) => <i key={i} className="h-3.5 w-3.5 rounded-full border border-line" style={{ background: c }} />)}</span></button>))}</div></section>)
}
export function TextoraPrefs() {
  const { profile, refresh } = useAuth(); const [, force] = useState(0)
  const set = async (k: string, v: string | boolean) => { await supabase.from('profiles').update({ [k]: v }).eq('id', profile!.id); refresh() }
  const flag = (k: string) => localStorage.getItem(k) !== 'off'; const toggle = (k: string, v: boolean) => { localStorage.setItem(k, v ? 'on' : 'off'); force(n => n + 1) }
  const row = 'flex items-center justify-between gap-3 rounded-xl border border-line p-3'
  return (<div className="flex flex-col gap-5">
    <section className="flex flex-col gap-2"><h2 className="font-bold">Privacy</h2>
      <label className={row}><span>Show my active status<small className="block text-mute">When off, others can't see when you're online, and you can't see theirs.</small></span><input type="checkbox" checked={profile?.show_active !== false} onChange={e => set('show_active', e.target.checked)} /></label>
      <label className={row}><span>Who can start a chat with me</span><select className="rounded-lg border border-line bg-bg px-2 py-1" value={profile?.who_can_message ?? 'everyone'} onChange={e => set('who_can_message', e.target.value)}><option value="everyone">Everyone</option><option value="friends">Friends only</option><option value="nobody">Nobody</option></select></label>
      <p className="text-sm text-mute">Active status is an estimate based on this app being open. It can't see whether your phone's mobile data is on.</p></section>
    <section className="flex flex-col gap-2"><h2 className="font-bold">Sounds</h2>
      <label className={row}>Notification sound<input type="checkbox" checked={flag('notifySound')} onChange={e => toggle('notifySound', e.target.checked)} /></label>
      <label className={row}>Notification volume<select className="rounded-lg border border-line bg-bg px-2 py-1" defaultValue={localStorage.getItem('notifyVol') ?? 'high'} onChange={e => localStorage.setItem('notifyVol', e.target.value)}><option value="low">Low</option><option value="mid">Medium</option><option value="high">High</option></select></label>
      <button onClick={() => playNotify(true)} className="rounded-xl border border-line p-3 text-left">▶ Play a test sound</button>
      <label className={row}>Message seen sound<input type="checkbox" checked={flag('seenSound')} onChange={e => toggle('seenSound', e.target.checked)} /></label>
      <label className={row}>Message sent sound<input type="checkbox" checked={flag('sendSound')} onChange={e => toggle('sendSound', e.target.checked)} /></label>
      <label className={row}>Someone is typing sound<input type="checkbox" checked={flag('typingSound')} onChange={e => toggle('typingSound', e.target.checked)} /></label>
      <p className="text-sm text-mute">Sounds play while the app is open. When it is closed, push notifications alert you (mute a chat to silence it).</p></section>
    <PushStatusCard /><ExtraPrefs /><TypingAnother /><BlockedList /></div>)
}
