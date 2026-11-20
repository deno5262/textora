import { useEffect, useState, ReactNode } from 'react'
import { Bell, ChevronRight, Check, Eye, Keyboard, Lock, MessageCircle, Palette, ShieldBan, Smartphone, UserCheck, Volume2, Wrench } from 'lucide-react'
import { supabase, THEMES, THEME_COLORS } from './supabase'
import { useAuth } from './AuthContext'
import { playNotify } from './sounds'
import { usePushStatus, setupPush } from './push'
import { useBackClose } from './useBackClose'
import { Avatar } from './ui'
import { loadCustom, saveCustom, clearCustom, Custom } from './customTheme'

/* ---------- small building blocks (kept simple on purpose) ---------- */
const Switch = ({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) => (
  <button role="switch" aria-checked={on} onClick={() => onChange(!on)} className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${on ? 'bg-accent' : 'bg-line'}`}>
    <i className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} /></button>)
function Group({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (<section><h2 className="px-1 pb-2 text-xs font-semibold uppercase tracking-wide text-mute">{title}</h2>
    <div className="divide-y divide-line overflow-hidden rounded-2xl bg-surface">{children}</div>
    {note && <p className="px-1 pt-2 text-xs text-mute">{note}</p>}</section>)
}
function Row({ icon: Icon, title, sub, right, onClick, danger }: { icon?: any; title: string; sub?: string; right?: ReactNode; onClick?: () => void; danger?: boolean }) {
  const inner = (<>{Icon && <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full bg-bg ${danger ? 'text-red-400' : 'text-accent'}`}><Icon size={18} /></span>}
    <span className="min-w-0 flex-1 text-left"><span className={`block ${danger ? 'text-red-400' : ''}`}>{title}</span>{sub && <span className="block text-xs text-mute">{sub}</span>}</span>
    {right}</>)
  const cls = 'flex w-full items-center gap-3 px-4 py-3'
  return onClick ? <button onClick={onClick} className={cls}>{inner}</button> : <div className={cls}>{inner}</div>
}
function BottomSheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useBackClose(true, onClose)
  return (<div className="fixed inset-0 z-50 flex items-end bg-black/50" onClick={onClose}>
    <div onClick={e => e.stopPropagation()} className="max-h-[80vh] w-full overflow-y-auto rounded-t-3xl bg-surface p-4" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
      <b className="mb-2 block text-lg">{title}</b>{children}</div></div>)
}
/** A row that shows its current value and opens a list of choices. */
function Choice({ icon, title, sub, value, options, onPick }: { icon?: any; title: string; sub?: string; value: string; options: [string, string, string?][]; onPick: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const label = options.find(o => o[0] === value)?.[1] ?? value
  return (<><Row icon={icon} title={title} sub={sub} onClick={() => setOpen(true)} right={<span className="flex items-center gap-1 text-sm text-mute">{label}<ChevronRight size={18} /></span>} />
    {open && <BottomSheet title={title} onClose={() => setOpen(false)}>
      {options.map(([k, l, d]) => <button key={k} onClick={() => { onPick(k); setOpen(false) }} className="flex w-full items-center gap-3 rounded-xl px-2 py-3 text-left">
        <span className="min-w-0 flex-1"><span className="block">{l}</span>{d && <span className="block text-xs text-mute">{d}</span>}</span>{value === k && <Check size={20} className="text-accent" />}</button>)}
    </BottomSheet>}</>)
}

/* ---------- data helpers ---------- */
function useLockPref(uid: string) {
  const [v, setV] = useState<string>(localStorage.getItem('lockPref') ?? 'show'); const [err, setErr] = useState('')
  useEffect(() => { supabase.from('push_prefs').select('lock_screen').eq('user_id', uid).maybeSingle().then(({ data }) => { const l = (data as any)?.lock_screen; if (l) { setV(l); localStorage.setItem('lockPref', l) } }) }, [uid])
  const save = async (n: string) => {
    setV(n); localStorage.setItem('lockPref', n); setErr('')
    const { error } = await supabase.from('push_prefs').upsert({ user_id: uid, lock_screen: n, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
    if (error) setErr(error.message)
  }
  return { v, save, err }
}

function BlockedSheet({ onClose }: { onClose: () => void }) {
  const { session } = useAuth(); const uid = session!.user.id; const [list, setList] = useState<any[] | null>(null)
  const load = () => supabase.from('blocks').select('blocked_id,who:profiles!blocks_blocked_id_fkey(id,username,full_name,avatar_url)').eq('blocker_id', uid).then(({ data }) => setList(data ?? []))
  useEffect(() => { load() }, [])
  const unblock = async (id: string) => { await supabase.from('blocks').delete().eq('blocker_id', uid).eq('blocked_id', id); load() }
  return (<BottomSheet title="Blocked users" onClose={onClose}>
    {!list && <p className="py-4 text-center text-mute">Loading…</p>}
    {list && !list.length && <p className="py-4 text-center text-mute">You haven't blocked anyone.</p>}
    {list?.map(b => <div key={b.blocked_id} className="flex items-center justify-between gap-3 py-2"><span className="min-w-0 truncate"><b>{b.who.full_name || b.who.username}</b> <span className="text-sm text-mute">@{b.who.username}</span></span>
      <button onClick={() => unblock(b.blocked_id)} className="rounded-full border border-line px-3 py-1 text-sm">Unblock</button></div>)}
    <p className="pt-2 text-xs text-mute">Blocked people can't message you.</p></BottomSheet>)
}

function TypingAllowSheet({ onClose }: { onClose: () => void }) {
  const { session } = useAuth(); const uid = session!.user.id
  const [friends, setFriends] = useState<any[] | null>(null); const [allowed, setAllowed] = useState<Set<string>>(new Set())
  useEffect(() => { (async () => {
    const { data: fs } = await supabase.from('friendships').select('user_a,user_b'); const ids = (fs ?? []).map((r: any) => (r.user_a === uid ? r.user_b : r.user_a))
    const [ps, al] = await Promise.all([ids.length ? supabase.from('profiles').select('id,username,full_name,avatar_url').in('id', ids) : Promise.resolve({ data: [] as any[] }), supabase.from('typing_allow').select('viewer').eq('owner', uid)])
    setFriends((ps.data ?? []) as any[]); setAllowed(new Set(((al.data ?? []) as any[]).map(r => r.viewer)))
  })() }, [])
  const flip = async (id: string) => { const n = new Set(allowed); if (n.has(id)) { n.delete(id); await supabase.from('typing_allow').delete().eq('owner', uid).eq('viewer', id) } else { n.add(id); await supabase.from('typing_allow').insert({ owner: uid, viewer: id }) } setAllowed(n) }
  return (<BottomSheet title="Who can see my typing status" onClose={onClose}>
    {!friends && <p className="py-4 text-center text-mute">Loading…</p>}
    {friends && !friends.length && <p className="py-4 text-center text-mute">No friends yet.</p>}
    {friends?.map(f => <div key={f.id} className="flex items-center gap-3 py-2"><Avatar a={f} s={40} /><span className="min-w-0 flex-1 truncate">{f.full_name || f.username}</span><Switch on={allowed.has(f.id)} onChange={() => flip(f.id)} /></div>)}</BottomSheet>)
}

function TestPush() {
  const [msg, setMsg] = useState('')
  const run = async () => { setMsg('Sending…'); const { data, error } = await supabase.functions.invoke('send-push', { body: { test: true } }); setMsg(error ? 'Failed: ' + error.message : String((data as any)?.info ?? 'Done')) }
  return (<div className="flex flex-col gap-2 px-4 pb-3"><button onClick={run} className="rounded-xl border border-line px-4 py-2 font-semibold">Send me a test notification</button>{msg && <p className="text-xs text-mute">{msg} — close the app now to see it.</p>}</div>)
}

function PushStatus() {
  const { profile } = useAuth(); const s = usePushStatus()
  const line = (k: string, v: string, ok?: boolean) => <p className="flex justify-between gap-3 text-sm"><span className="text-mute">{k}</span><span className={ok === undefined ? '' : ok ? 'text-green-400' : 'text-red-400'}>{v}</span></p>
  return (<div className="flex flex-col gap-1.5 px-4 py-3">
    {line('Android app', s.native ? 'yes' : 'no', s.native)}{line('Push in this build', s.flag ? 'ON' : 'OFF', s.flag)}{line('Permission', s.perm, s.perm === 'granted')}{line('Bubble mode', s.bubbles, s.bubbles === 'on')}{line('Device token', s.token, s.token !== '-')}{line('Saved to server', s.saved, s.saved.startsWith('saved'))}
    {s.error && <p className="rounded-lg bg-red-950 p-2 text-xs text-red-300">{s.error}</p>}
    <button onClick={() => profile && setupPush(profile.id, true)} className="mt-1 rounded-xl bg-accent px-4 py-2 font-semibold text-on">Retry</button></div>)
}

function CustomThemeCard() {
  const base: Custom = { bg: '#0e1127', surface: '#1b1f3a', accent: '#5b6cff' }
  const [c, setC] = useState<Custom>(loadCustom() ?? base)
  const pick = (k: keyof Custom, v: string) => { const n = { ...c, [k]: v }; setC(n); saveCustom(n) }
  return (<div className="p-3"><p className="mb-2 text-sm text-mute">Make your own colours</p>
    <div className="grid grid-cols-3 gap-2">{([['bg', 'Background'], ['surface', 'Cards'], ['accent', 'Buttons']] as const).map(([k, l]) => (
      <label key={k} className="flex flex-col items-center gap-1 text-xs"><input type="color" value={c[k]} onChange={e => pick(k, e.target.value)} className="h-12 w-full rounded-lg border border-line bg-transparent" />{l}</label>))}</div>
    <button onClick={() => { clearCustom(); setC(base) }} className="mt-3 w-full rounded-xl border border-line py-2 text-sm">Reset to app theme</button></div>)
}
/* ---------- the page ---------- */
export function TextoraPrefs() {
  const { profile, refresh, theme, setTheme, session } = useAuth(); const uid = session!.user.id
  const [, force] = useState(0); const [pickTyping, setPickTyping] = useState(false); const [blocked, setBlocked] = useState(false); const [fix, setFix] = useState(false)
  const lock = useLockPref(uid)
  const set = async (k: string, v: string | boolean) => { await supabase.from('profiles').update({ [k]: v }).eq('id', profile!.id); refresh() }
  const flag = (k: string) => localStorage.getItem(k) !== 'off'; const toggle = (k: string, v: boolean) => { localStorage.setItem(k, v ? 'on' : 'off'); force(n => n + 1) }
  const typingOn = !!profile?.typing_status_enabled
  return (<div className="flex flex-col gap-6 pb-6">
    {profile && <div className="flex items-center gap-4 rounded-2xl bg-surface p-4"><Avatar a={profile} s={64} /><div className="min-w-0"><b className="block truncate text-xl">{profile.full_name || profile.username}</b><span className="text-sm text-mute">@{profile.username}</span></div></div>}

    <Group title="Notifications" note="Applies when the app is closed. Notifications never show inside the app while you are using it.">
      <Choice icon={Lock} title="Lock screen" sub="What others can see on your locked phone" value={lock.v} onPick={lock.save}
        options={[['show', 'Show name and message'], ['name', 'Show name only', 'The message is replaced by “New message”'], ['hide', 'Hide everything', 'Only “TextGen: new message”']]} />
      <Row icon={MessageCircle} title="Chat bubbles" sub="Turn on in phone Settings → Apps → TextGen → Notifications → Bubbles" />
    </Group>
    {lock.err && <p className="-mt-3 rounded-xl bg-red-950 p-3 text-xs text-red-300">Couldn't save: {lock.err}</p>}

    <Group title="Sounds">
      <Row icon={Volume2} title="Notification sound" right={<Switch on={flag('notifySound')} onChange={v => toggle('notifySound', v)} />} />
      <Choice title="Volume" value={localStorage.getItem('notifyVol') ?? 'high'} onPick={v => { localStorage.setItem('notifyVol', v); force(n => n + 1) }} options={[['low', 'Low'], ['mid', 'Medium'], ['high', 'High']]} />
      <Row title="Message sent sound" right={<Switch on={flag('sendSound')} onChange={v => toggle('sendSound', v)} />} />
      <Row title="Message seen sound" right={<Switch on={flag('seenSound')} onChange={v => toggle('seenSound', v)} />} />
      <Row title="Typing sound" right={<Switch on={flag('typingSound')} onChange={v => toggle('typingSound', v)} />} />
      <Row title="Play a test sound" onClick={() => playNotify(true)} />
    </Group>

    <Group title="Appearance">
      <div className="p-3"><p className="mb-2 flex items-center gap-2 text-sm text-mute"><Palette size={16} />App theme (also on the colour button at the top)</p>
        <div className="grid grid-cols-2 gap-2">{THEMES.map(([k, name]) => (
          <button key={k} onClick={() => setTheme(k)} className={`flex items-center justify-between gap-2 rounded-xl border p-2.5 text-left text-sm ${theme === k ? 'border-accent text-accent' : 'border-line'}`}>
            <span className="truncate">{name}</span><span className="flex shrink-0 gap-1">{(THEME_COLORS[k] ?? []).map((c, i) => <i key={i} className="h-3.5 w-3.5 rounded-full border border-line" style={{ background: c }} />)}</span></button>))}</div></div>
      <CustomThemeCard />
    </Group>

    <Group title="Privacy" note="Active status is an estimate based on this app being open.">
      <Row icon={Eye} title="Active status" sub="Let others see when you're online" right={<Switch on={profile?.show_active !== false} onChange={v => set('show_active', v)} />} />
      <Choice icon={UserCheck} title="Who can message me" value={profile?.who_can_message ?? 'everyone'} onPick={v => set('who_can_message', v)} options={[['everyone', 'Everyone'], ['friends', 'Friends only'], ['nobody', 'Nobody']]} />
      <Row icon={ShieldBan} title="Blocked users" onClick={() => setBlocked(true)} right={<ChevronRight size={18} className="text-mute" />} />
    </Group>

    <Group title="Typing status" note="Others only see that you are busy in a chat. Never the message itself.">
      <Row icon={Keyboard} title="Show a status while I'm typing" right={<Switch on={typingOn} onChange={v => set('typing_status_enabled', v)} />} />
      {typingOn && <>
        <Row title="Show who I'm chatting with" sub="Off shows “Typing with another”. No one else needs to agree." right={<Switch on={!!profile?.typing_show_name} onChange={v => set('typing_show_name', v)} />} />
        <Choice title="Who can see it" value={profile?.typing_visibility ?? 'friends'} onPick={v => set('typing_visibility', v)} options={[['everyone', 'Everyone'], ['friends', 'Friends'], ['custom', 'Selected friends'], ['private', 'Only me']]} />
        {profile?.typing_visibility === 'custom' && <Row title="Choose friends" sub="Only they can see your typing status" onClick={() => setPickTyping(true)} right={<ChevronRight size={18} className="text-mute" />} />}</>}
    </Group>

    <Group title="Help">
      <Row icon={Wrench} title="Notification problems?" sub="Check why alerts are not arriving" onClick={() => setFix(f => !f)} right={<ChevronRight size={18} className={`text-mute transition-transform ${fix ? 'rotate-90' : ''}`} />} />
      {fix && <PushStatus />}
      {fix && <TestPush />}
      <Row icon={Smartphone} title="TextGen" sub="Next generation messaging · Version 0.4" />
    </Group>

    <Group title="Account"><Row icon={Bell} title="Log out" danger onClick={async () => { const { dropPushToken } = await import('./push'); await dropPushToken(); await supabase.auth.signOut() }} /></Group>
    {blocked && <BlockedSheet onClose={() => setBlocked(false)} />}
    {pickTyping && <TypingAllowSheet onClose={() => setPickTyping(false)} />}
  </div>)
}
