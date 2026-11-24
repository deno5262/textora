import { ReactNode, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Room, RoomEvent, Track } from 'livekit-client'
import { ArrowLeft, Crown, Flag, Hand, Lock, MessageCircle, Mic, MicOff, Plus, Radio, Send, Settings, Unlock, UserMinus, UserPlus, Users, X } from 'lucide-react'
import { startDirect } from './textora'
import { supabase } from './supabase'
import { useAuth } from './AuthContext'
import { Avatar } from './ui'

type RoomRow = { id: string; host_id: string; title: string; seat_count: number; mode: 'open' | 'request'; status: string }
type SeatRow = { seat_no: number; user_id: string | null; locked: boolean; muted: boolean }
type ReqRow = { user_id: string; seat_no: number | null; created_at: string }
type ChatMsg = { id: string; user_id: string; body: string; created_at: string }
type P = { id: string; username: string; full_name: string; avatar_url: string | null }
type Aud = { id: string; name: string; avatar: string }
type Sheet = { kind: 'seat'; seat: SeatRow } | { kind: 'aud'; who: Aud } | { kind: 'reqs' } | { kind: 'end' } | { kind: 'host' } | null
const REASONS = ['Spam or scam', 'Abusive or hate speech', 'Sexual or inappropriate content', 'Harassment or bullying', 'Someone underage', 'Something else']

async function liveFn(action: string, payload: Record<string, unknown> = {}) {
  const { data, error } = await supabase.functions.invoke('live', { body: { action, ...payload } })
  if (error) { let m = error.message; try { const j = await (error as any).context?.json(); if (j?.error) m = j.error } catch { /* ignore */ } throw new Error(m) }
  return data as any
}
const nameOf = (p?: P) => p?.full_name || p?.username || 'Guest'

function SeatCell({ seat, user, big, speaking, onTap }: { seat: SeatRow; user?: P; big?: boolean; speaking: boolean; onTap: () => void }) {
  const size = big ? 88 : 62
  return (<button onClick={onTap} className="flex flex-col items-center gap-1 active:opacity-70">
    <span className="relative grid place-items-center" style={{ width: size, height: size }}>
      {speaking && <span className="absolute inset-0 animate-ping rounded-full bg-green-400/40" />}
      {user ? <span className={`relative rounded-full ${speaking ? 'ring-4 ring-green-400' : 'ring-2 ring-line'}`}><Avatar a={user} s={size - 6} /></span>
        : <span className="grid h-full w-full place-items-center rounded-full border-2 border-dashed border-line text-mute">{seat.locked ? <Lock size={20} /> : <Plus size={24} />}</span>}
      {user && seat.muted && <span className="absolute -bottom-0.5 -right-0.5 grid h-6 w-6 place-items-center rounded-full bg-red-600 text-white"><MicOff size={13} /></span>}
      {big && <span className="absolute -top-2 grid h-6 w-6 place-items-center rounded-full bg-yellow-400 text-black"><Crown size={14} /></span>}
    </span>
    <span className="max-w-[74px] truncate text-[11px]">{user ? nameOf(user) : seat.locked ? 'Locked' : big ? 'Host' : String(seat.seat_no)}</span></button>)
}
function SheetBox({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (<div className="fixed inset-0 z-[60] flex items-end bg-black/60" onClick={onClose}>
    <div onClick={e => e.stopPropagation()} className="max-h-[75vh] w-full overflow-y-auto rounded-t-3xl bg-surface p-4" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
      <div className="mb-2 flex items-center justify-between"><b className="text-lg">{title}</b><button onClick={onClose} aria-label="Close" className="p-1 text-mute"><X /></button></div>{children}</div></div>)
}

export default function LiveRoom() {
  const { id } = useParams(); const rid = id!; const { session } = useAuth(); const uid = session!.user.id; const nav = useNavigate()
  const [room, setRoom] = useState<RoomRow | null | undefined>(undefined); const [seats, setSeats] = useState<SeatRow[]>([]); const [reqs, setReqs] = useState<ReqRow[]>([]); const [msgs, setMsgs] = useState<ChatMsg[]>([])
  const [people, setPeople] = useState<Record<string, P>>({}); const [ended, setEnded] = useState(false); const [banned, setBanned] = useState(false); const [toast, setToast] = useState('')
  const lk = useRef<Room | null>(null); const [conn, setConn] = useState<'connecting' | 'on' | 'offline'>('connecting'); const [canPub, setCanPub] = useState(false); const [speaking, setSpeaking] = useState<Set<string>>(new Set())
  const [aud, setAud] = useState<Aud[]>([]); const [count, setCount] = useState(1); const [selfMuted, setSelfMuted] = useState(false); const [sheet, setSheet] = useState<Sheet>(null); const [text, setText] = useState('')
  const seatsRef = useRef<SeatRow[]>([]); const hostRef = useRef(false); const endedRef = useRef(false); const chatEnd = useRef<HTMLDivElement>(null); const known = useRef<Set<string>>(new Set())
  const { profile } = useAuth(); const [pres, setPres] = useState<Aud[]>([]); const [connErr, setConnErr] = useState(''); const [tryN, setTryN] = useState(0)
  const [dm, setDm] = useState<{ id: string; name: string } | null>(null); const [dmText, setDmText] = useState(''); const [report, setReport] = useState<{ id: string; name: string } | null>(null)
  seatsRef.current = seats
  const isHost = room?.host_id === uid; hostRef.current = !!isHost
  const mySeat = seats.find(s => s.user_id === uid)
  const flash = (m: string) => { setToast(m); window.setTimeout(() => setToast(''), 2600) }

  const ensure = async (ids: string[]) => {
    const need = ids.filter(i => i && !known.current.has(i)); if (!need.length) return; need.forEach(i => known.current.add(i))
    const { data } = await supabase.from('profiles').select('id,username,full_name,avatar_url').in('id', need)
    if (data) setPeople(cur => ({ ...cur, ...Object.fromEntries((data as P[]).map(p => [p.id, p])) }))
  }
  const loadSeats = async () => { const { data } = await supabase.from('live_seats').select('*').eq('room_id', rid).order('seat_no'); if (data) { setSeats(data as SeatRow[]); ensure((data as SeatRow[]).map(s => s.user_id ?? '')) } }
  const loadReqs = async () => { const { data } = await supabase.from('live_requests').select('*').eq('room_id', rid).order('created_at'); if (data) { setReqs(data as ReqRow[]); ensure((data as ReqRow[]).map(r => r.user_id)) } }

  // ---- load + realtime ----
  useEffect(() => {
    let dead = false
    ;(async () => {
      const [r, c] = await Promise.all([supabase.from('live_rooms').select('*').eq('id', rid).maybeSingle(), supabase.from('live_chat').select('*').eq('room_id', rid).order('created_at', { ascending: false }).limit(40)])
      if (dead) return; const row = (r.data as RoomRow | null) ?? null; setRoom(row); if (row?.status === 'ended') setEnded(true)
      const list = ((c.data ?? []) as ChatMsg[]).reverse(); setMsgs(list); ensure([row?.host_id ?? '', ...list.map(m => m.user_id)]); loadSeats(); loadReqs()
    })()
    const ch = supabase.channel('live-' + rid, { config: { presence: { key: uid } } })
      .on('presence', { event: 'sync' }, () => { const seen = new Map<string, Aud>(); Object.values(ch.presenceState()).forEach((arr: any) => arr.forEach((p: any) => { if (p?.id) seen.set(p.id, { id: p.id, name: p.name || 'Guest', avatar: p.avatar || '' }) })); setPres([...seen.values()]) })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_seats', filter: `room_id=eq.${rid}` }, () => loadSeats())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_requests', filter: `room_id=eq.${rid}` }, () => loadReqs())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'live_chat', filter: `room_id=eq.${rid}` }, (p: any) => { const m = p.new as ChatMsg; setMsgs(cur => (cur.some(x => x.id === m.id) ? cur : [...cur.slice(-80), m])); ensure([m.user_id]) })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'live_rooms', filter: `id=eq.${rid}` }, (p: any) => { setRoom(p.new as RoomRow); if (p.new?.status === 'ended') setEnded(true) })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'live_bans', filter: `user_id=eq.${uid}` }, (p: any) => { if (p.new?.room_id === rid) setBanned(true) })
      .subscribe(async (st: string) => { if (st === 'SUBSCRIBED') await ch.track({ id: uid, name: profile?.full_name || profile?.username || 'Guest', avatar: profile?.avatar_url ?? '' }) })
    return () => { dead = true; supabase.removeChannel(ch) }
  }, [rid])
  useEffect(() => { chatEnd.current?.scrollIntoView({ block: 'end' }) }, [msgs.length])

  // ---- LiveKit ----
  const refreshAud = () => {
    const r = lk.current; if (!r) return
    const all = [r.localParticipant, ...Array.from(r.remoteParticipants.values())]
    setAud(all.map(p => { let m: any = {}; try { m = JSON.parse(p.metadata || '{}') } catch { /* ignore */ } return { id: p.identity, name: p.name || 'Guest', avatar: m.avatar || '' } }))
    setCount(Math.max(r.numParticipants || 0, all.length))
  }
  useEffect(() => {
    if (!room || ended || banned) return; let dead = false; setConn('connecting'); setConnErr('')
    ;(async () => {
      try {
        const d = await liveFn('token', { room_id: rid }); if (dead) return
        const r = new Room({ adaptiveStream: true, dynacast: true, audioCaptureDefaults: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
        r.on(RoomEvent.ActiveSpeakersChanged, sp => setSpeaking(new Set(sp.map(p => p.identity))))
        r.on(RoomEvent.TrackSubscribed, track => { if (track.kind === Track.Kind.Audio) { const el = track.attach(); el.setAttribute('data-live', '1'); document.body.appendChild(el) } })
        r.on(RoomEvent.TrackUnsubscribed, track => { track.detach().forEach(el => el.remove()) })
        r.on(RoomEvent.ParticipantConnected, refreshAud); r.on(RoomEvent.ParticipantMetadataChanged, refreshAud)
        r.on(RoomEvent.ParticipantDisconnected, p => {
          refreshAud()
          if (!hostRef.current) return; const s = seatsRef.current.find(x => x.user_id === p.identity && x.seat_no > 0)
          if (s) window.setTimeout(() => { if (!lk.current?.remoteParticipants.has(p.identity)) supabase.rpc('live_seat_admin', { p_room: rid, p_seat: s.seat_no, p_action: 'clear' }) }, 20000)   // seat holder left: free the seat
        })
        r.on(RoomEvent.ParticipantPermissionsChanged, (_prev, p) => { if (p.isLocal) setCanPub(!!p.permissions?.canPublish) })
        r.on(RoomEvent.Disconnected, () => { if (!dead) setConn('offline') })
        await r.connect(d.url, d.token); if (dead) { r.disconnect(); return }
        lk.current = r; await r.startAudio().catch(() => {}); setCanPub(!!d.canPublish); setConn('on'); setConnErr(''); refreshAud()
      } catch (e) {
        const msg = String((e as Error).message ?? e)
        if (/ended|410/.test(msg)) setEnded(true); else if (/banned|403/.test(msg)) setBanned(true); else { setConn('offline'); setConnErr(msg) }
      }
    })()
    return () => { dead = true; lk.current?.disconnect(); lk.current = null; document.querySelectorAll('audio[data-live]').forEach(el => el.remove()) }
  }, [room?.id, ended, banned, tryN])
  useEffect(() => { if (conn !== 'on' || !room) return; const should = isHost || (!!mySeat && !mySeat.muted); if (should !== canPub) liveFn('sync', { room_id: rid }).catch(() => {}) }, [mySeat?.seat_no, mySeat?.muted, conn, canPub, isHost])
  useEffect(() => { const r = lk.current; if (!r || conn !== 'on') return; r.localParticipant.setMicrophoneEnabled(canPub && (!!isHost || !!mySeat) && !selfMuted).catch((e: Error) => flash('Microphone: ' + e.message)) }, [canPub, isHost, mySeat?.seat_no, selfMuted, conn])
  useEffect(() => {   // the host keeps the room "alive"; when the host leaves, the live ends
    if (!isHost || ended) return; const beat = () => supabase.from('live_rooms').update({ last_beat: new Date().toISOString() }).eq('id', rid).then(() => {}); beat(); const i = window.setInterval(beat, 20000)
    return () => { window.clearInterval(i) }
  }, [isHost, ended])
  useEffect(() => () => { if (hostRef.current && !endedRef.current) { supabase.rpc('live_end', { p_room: rid }).then(() => liveFn('end', { room_id: rid }).catch(() => {})) } else if (!hostRef.current) supabase.rpc('live_leave_seat', { p_room: rid }).then(() => {}) }, [])
  useEffect(() => { endedRef.current = ended }, [ended])

  // ---- actions ----
  const run = async (fn: () => PromiseLike<any>, ok?: string) => { const r = await fn(); if (r?.error) flash(r.error.message); else if (ok) flash(ok); return !r?.error }
  const tapSeat = async (s: SeatRow) => {
    if (!room) return
    if (s.user_id) { if (isHost && s.seat_no > 0) setSheet({ kind: 'seat', seat: s }); else if (s.user_id === uid && s.seat_no > 0) setSheet({ kind: 'seat', seat: s }); return }
    if (isHost) { if (s.seat_no > 0) setSheet({ kind: 'seat', seat: s }); return }
    if (s.locked) return flash('That seat is locked')
    if (room.mode === 'open') { if (await run(() => supabase.rpc('live_take_seat', { p_room: rid, p_seat: s.seat_no }))) liveFn('sync', { room_id: rid }).catch(() => {}) }
    else await run(() => supabase.rpc('live_request_seat', { p_room: rid, p_seat: s.seat_no }), 'Request sent. Wait for the host.')
  }
  const joinBoard = () => { const free = seats.find(s => s.seat_no > 0 && !s.user_id && !s.locked); if (!free) return flash('No free seat right now'); tapSeat(free) }
  const admin = async (seat: SeatRow, action: string) => { if (await run(() => supabase.rpc('live_seat_admin', { p_room: rid, p_seat: seat.seat_no, p_action: action }))) { if (seat.user_id) liveFn('sync', { room_id: rid, user_id: seat.user_id }).catch(() => {}); setSheet(null) } }
  const kick = async (userId: string) => { if (await run(() => supabase.rpc('live_kick', { p_room: rid, p_user: userId }), 'Removed from the live')) { liveFn('kick', { room_id: rid, user_id: userId }).catch(() => {}); setSheet(null) } }
  const respond = async (userId: string, accept: boolean) => { if (await run(() => supabase.rpc('live_respond', { p_room: rid, p_user: userId, p_accept: accept }))) { if (accept) liveFn('sync', { room_id: rid, user_id: userId }).catch(() => {}) } }
  const sendDm = async () => { const b = dmText.trim(); if (!b || !dm) return; try { const cid = await startDirect(dm.id); const { error } = await supabase.from('messages').insert({ conversation_id: cid, sender_id: uid, kind: 'text', body: b }); if (error) throw error; setDm(null); setDmText(''); flash('Message sent ✓') } catch (e) { flash('Could not send: ' + ((e as Error).message ?? e)) } }
  const sendReport = async (reason: string) => { if (!report) return; const r = report; setReport(null); const { error } = await supabase.from('live_reports').insert({ room_id: rid, reporter_id: uid, target_id: r.id, reason }); flash(error ? 'Could not report: ' + error.message : 'Thanks. We will review this report.') }
  const invite = async (userId: string) => { if (await run(() => supabase.rpc('live_assign', { p_room: rid, p_user: userId }), 'Invited to the board')) { liveFn('sync', { room_id: rid, user_id: userId }).catch(() => {}); setSheet(null) } }
  const muteAll = async (muted: boolean) => { if (await run(() => supabase.rpc('live_mute_all', { p_room: rid, p_muted: muted }), muted ? 'Everyone on the board is muted' : 'Everyone can speak')) seatsRef.current.filter(s => s.seat_no > 0 && s.user_id).forEach(s => liveFn('sync', { room_id: rid, user_id: s.user_id }).catch(() => {})) }
  const setMode = async (mode: 'open' | 'request') => { setRoom(r => (r ? { ...r, mode } : r)); await run(() => supabase.from('live_rooms').update({ mode }).eq('id', rid)) }
  const endLive = async () => { endedRef.current = true; await supabase.rpc('live_end', { p_room: rid }); liveFn('end', { room_id: rid }).catch(() => {}); nav('/textora/live') }
  const leave = () => { if (isHost) setSheet({ kind: 'end' }); else nav('/textora/live') }
  const send = async () => { const b = text.trim(); if (!b) return; setText(''); const { data, error } = await supabase.from('live_chat').insert({ room_id: rid, user_id: uid, body: b }).select('*').single(); if (error) return flash(error.message); const m = data as ChatMsg; setMsgs(cur => (cur.some(x => x.id === m.id) ? cur : [...cur.slice(-80), m])) }

  if (room === undefined) return <div className="fixed inset-0 z-40 grid place-items-center bg-bg text-mute">Loading…</div>
  if (room === null) return <div className="fixed inset-0 z-40 grid place-items-center bg-bg p-6 text-center"><div><p className="mb-3">This live does not exist.</p><button onClick={() => nav('/textora/live')} className="rounded-full bg-accent px-5 py-2 font-semibold text-on">Back</button></div></div>
  if (ended || banned) return <div className="fixed inset-0 z-40 grid place-items-center bg-bg p-6 text-center"><div><Radio className="mx-auto mb-2 text-mute" size={40} /><p className="mb-3 text-lg font-bold">{banned ? 'You were removed from this live' : 'This live has ended'}</p><button onClick={() => nav('/textora/live')} className="rounded-full bg-accent px-5 py-2 font-semibold text-on">Back to Live</button></div></div>

  const host = people[room.host_id]; const hostSeat = seats.find(s => s.seat_no === 0) ?? { seat_no: 0, user_id: room.host_id, locked: false, muted: false }
  const guests = seats.filter(s => s.seat_no > 0); const seated = new Set(seats.map(s => s.user_id).filter(Boolean) as string[]); const audience = (pres.length ? pres : aud).filter(a => !seated.has(a.id))
  const myReq = reqs.find(r => r.user_id === uid)

  return (<div className="fixed inset-0 z-40 flex flex-col text-ink" style={{ background: 'radial-gradient(120% 80% at 50% 0%, var(--surface), var(--bg))', paddingTop: 'env(safe-area-inset-top)' }}>
    <div className="flex items-center gap-2 px-3 py-2">
      <button onClick={leave} aria-label="Leave" className="p-2"><ArrowLeft /></button>
      <div className="min-w-0 flex-1"><b className="block truncate">{room.title}</b><span className="flex items-center gap-2 text-xs text-mute"><span className="flex items-center gap-1 rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />LIVE</span><span className="flex items-center gap-1"><Users size={12} />{Math.max(pres.length, count)}</span>{conn !== 'on' && <span className="text-yellow-400">{conn === 'connecting' ? 'Connecting…' : 'Offline'}</span>}</span></div>
      {isHost && <button onClick={() => setSheet({ kind: 'host' })} aria-label="Live settings" className="rounded-full bg-bg p-2"><Settings size={20} /></button>}
      {!isHost && <button onClick={() => setReport({ id: room.host_id, name: nameOf(host) })} aria-label="Report this live" className="rounded-full bg-bg p-2 text-mute"><Flag size={18} /></button>}
      {isHost && <button onClick={() => setSheet({ kind: 'reqs' })} aria-label="Requests" className="relative rounded-full bg-bg p-2"><Hand size={20} />{reqs.length > 0 && <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">{reqs.length}</span>}</button>}</div>

    {connErr && <div className="mx-3 mb-1 rounded-xl bg-red-950 p-3 text-xs text-red-300">Voice is not connected: {connErr} <button onClick={() => setTryN(n => n + 1)} className="ml-2 rounded-full border border-red-400 px-3 py-0.5 font-semibold">Retry</button></div>}
    <div className="flex flex-col items-center gap-4 px-3 pb-2 pt-1">
      <SeatCell seat={hostSeat} user={host} big speaking={speaking.has(room.host_id)} onTap={() => {}} />
      <div className="grid w-full grid-cols-4 gap-y-3">{guests.map(s => <div key={s.seat_no} className="flex justify-center"><SeatCell seat={s} user={s.user_id ? people[s.user_id] : undefined} speaking={!!s.user_id && speaking.has(s.user_id)} onTap={() => tapSeat(s)} /></div>)}</div></div>

    <div className="no-scrollbar flex items-center gap-2 overflow-x-auto px-3 py-2">
      <span className="shrink-0 text-xs text-mute">Listening ({audience.length})</span>
      {audience.slice(0, 40).map(a => <button key={a.id} onClick={() => a.id !== uid && setSheet({ kind: 'aud', who: a })} className="shrink-0">{a.avatar ? <img src={a.avatar} alt="" className="h-8 w-8 rounded-full object-cover" /> : <span className="grid h-8 w-8 place-items-center rounded-full bg-surface text-xs font-bold">{a.name[0]?.toUpperCase()}</span>}</button>)}</div>

    <div className="min-h-0 flex-1 overflow-y-auto px-3 py-1">
      {msgs.map(m => <p key={m.id} className="mb-1 w-fit max-w-[85%] rounded-2xl bg-black/25 px-3 py-1.5 text-sm"><b className="text-accent">{m.user_id === uid ? 'You' : nameOf(people[m.user_id])}</b> {m.body}</p>)}<div ref={chatEnd} /></div>
    {toast && <p className="mx-4 mb-1 rounded-full bg-surface px-4 py-2 text-center text-sm shadow-lg">{toast}</p>}

    <div className="flex items-center gap-2 px-3 pt-2" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
      {(isHost || mySeat) && <button onClick={() => { if (!canPub && conn === 'on') { liveFn('sync', { room_id: rid }).catch(() => {}); flash('Getting permission to speak…') } setSelfMuted(m => !m) }} aria-label="Microphone" className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${selfMuted || !canPub ? 'bg-red-600 text-white' : 'bg-green-600 text-white'}`}>{selfMuted || !canPub ? <MicOff size={20} /> : <Mic size={20} />}</button>}
      {!isHost && !mySeat && (myReq ? <button onClick={() => run(() => supabase.rpc('live_cancel_request', { p_room: rid }), 'Request cancelled')} className="shrink-0 rounded-full border border-line px-3 py-2 text-sm">Cancel request</button> : <button onClick={joinBoard} className="flex shrink-0 items-center gap-1 rounded-full bg-accent px-3 py-2 text-sm font-semibold text-on"><Hand size={16} />Join board</button>)}
      <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') send() }} maxLength={300} placeholder="Say something…" className="input min-w-0 flex-1" />
      <button onClick={send} aria-label="Send" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent text-on"><Send size={18} /></button></div>

    {sheet?.kind === 'seat' && (() => { const s = sheet.seat; const u = s.user_id ? people[s.user_id] : undefined; const me = s.user_id === uid; return (
      <SheetBox title={u ? nameOf(u) : `Seat ${s.seat_no}`} onClose={() => setSheet(null)}>
        <div className="flex flex-col gap-1">
          {me && <button onClick={async () => { setSheet(null); if (await run(() => supabase.rpc('live_leave_seat', { p_room: rid }))) liveFn('sync', { room_id: rid }).catch(() => {}) }} className="flex items-center gap-3 rounded-xl p-3 text-left"><UserMinus size={20} />Leave the seat</button>}
          {s.user_id && !me && <button onClick={() => { setSheet(null); setDm({ id: s.user_id!, name: nameOf(u) }) }} className="flex items-center gap-3 rounded-xl p-3 text-left"><MessageCircle size={20} />Send a message</button>}
          {s.user_id && !me && <button onClick={() => { setSheet(null); setReport({ id: s.user_id!, name: nameOf(u) }) }} className="flex items-center gap-3 rounded-xl p-3 text-left text-mute"><Flag size={20} />Report</button>}
          {isHost && s.user_id && !me && <>
            <button onClick={() => admin(s, s.muted ? 'unmute' : 'mute')} className="flex items-center gap-3 rounded-xl p-3 text-left">{s.muted ? <Mic size={20} /> : <MicOff size={20} />}{s.muted ? 'Allow to speak' : 'Mute'}</button>
            <button onClick={() => admin(s, 'clear')} className="flex items-center gap-3 rounded-xl p-3 text-left"><UserMinus size={20} />Move to listeners</button>
            <button onClick={() => kick(s.user_id!)} className="flex items-center gap-3 rounded-xl p-3 text-left text-red-400"><X size={20} />Kick out of the live</button></>}
          {isHost && !s.user_id && <button onClick={() => admin(s, s.locked ? 'unlock' : 'lock')} className="flex items-center gap-3 rounded-xl p-3 text-left">{s.locked ? <Unlock size={20} /> : <Lock size={20} />}{s.locked ? 'Unlock seat' : 'Lock seat'}</button>}</div></SheetBox>) })()}
    {sheet?.kind === 'aud' && <SheetBox title={sheet.who.name} onClose={() => setSheet(null)}><div className="flex flex-col gap-1">
      <button onClick={() => { const w = sheet.who; setSheet(null); setDm({ id: w.id, name: w.name }) }} className="flex items-center gap-3 rounded-xl p-3 text-left"><MessageCircle size={20} />Send a message</button>
      {isHost && <button onClick={() => invite(sheet.who.id)} className="flex items-center gap-3 rounded-xl p-3 text-left"><UserPlus size={20} />Invite to the board</button>}
      <button onClick={() => { const w = sheet.who; setSheet(null); setReport({ id: w.id, name: w.name }) }} className="flex items-center gap-3 rounded-xl p-3 text-left text-mute"><Flag size={20} />Report</button>
      {isHost && <button onClick={() => kick(sheet.who.id)} className="flex items-center gap-3 rounded-xl p-3 text-left text-red-400"><X size={20} />Kick out of the live</button>}</div></SheetBox>}
    {sheet?.kind === 'host' && <SheetBox title="Live settings" onClose={() => setSheet(null)}><div className="flex flex-col gap-2">
      <p className="text-xs text-mute">Who can take a seat</p>
      <div className="flex gap-2"><button onClick={() => setMode('request')} className={`flex-1 rounded-xl border p-2 text-sm ${room.mode === 'request' ? 'border-accent text-accent' : 'border-line'}`}>I approve first</button><button onClick={() => setMode('open')} className={`flex-1 rounded-xl border p-2 text-sm ${room.mode === 'open' ? 'border-accent text-accent' : 'border-line'}`}>Anyone, instantly</button></div>
      <button onClick={() => muteAll(true)} className="mt-1 flex items-center gap-3 rounded-xl p-3 text-left"><MicOff size={20} />Mute everyone on the board</button>
      <button onClick={() => muteAll(false)} className="flex items-center gap-3 rounded-xl p-3 text-left"><Mic size={20} />Let everyone speak</button>
      <button onClick={() => setSheet({ kind: 'end' })} className="flex items-center gap-3 rounded-xl p-3 text-left text-red-400"><X size={20} />End live</button></div></SheetBox>}
    {dm && <SheetBox title={`Message ${dm.name}`} onClose={() => setDm(null)}><textarea className="input w-full" rows={3} maxLength={500} autoFocus value={dmText} onChange={e => setDmText(e.target.value)} placeholder="Write a message…" /><button onClick={sendDm} disabled={!dmText.trim()} className="mt-3 w-full rounded-xl bg-accent py-3 font-semibold text-on disabled:opacity-50">Send</button><p className="mt-2 text-center text-xs text-mute">It arrives in their inbox. You stay in the live.</p></SheetBox>}
    {report && <SheetBox title={`Report ${report.name}`} onClose={() => setReport(null)}><div className="flex flex-col">{REASONS.map(r => <button key={r} onClick={() => sendReport(r)} className="rounded-xl p-3 text-left hover:bg-bg">{r}</button>)}</div></SheetBox>}
    {sheet?.kind === 'reqs' && <SheetBox title="Seat requests" onClose={() => setSheet(null)}>
      {!reqs.length && <p className="py-6 text-center text-mute">No requests right now.</p>}
      {reqs.map(r => { const p = people[r.user_id]; return (<div key={r.user_id} className="flex items-center gap-3 py-2">{p ? <Avatar a={p} s={44} /> : <span className="h-11 w-11 rounded-full bg-bg" />}<span className="min-w-0 flex-1"><b className="block truncate">{nameOf(p)}</b><span className="text-xs text-mute">{r.seat_no ? `wants seat ${r.seat_no}` : 'wants a seat'}</span></span>
        <button onClick={() => respond(r.user_id, true)} className="rounded-full bg-green-600 px-3 py-1.5 text-sm font-semibold text-white">Accept</button><button onClick={() => respond(r.user_id, false)} className="rounded-full border border-line px-3 py-1.5 text-sm">Reject</button></div>) })}</SheetBox>}
    {sheet?.kind === 'end' && <SheetBox title="End this live?" onClose={() => setSheet(null)}><p className="mb-3 text-sm text-mute">Everyone will be disconnected.</p><button onClick={endLive} className="w-full rounded-xl bg-red-600 py-3 font-bold text-white">End live</button></SheetBox>}
  </div>)
}
