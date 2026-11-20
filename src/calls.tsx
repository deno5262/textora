import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from 'react'
import { Flashlight, Mic, MicOff, Phone, PhoneOff, Sun, SwitchCamera, Video, VideoOff, Waves } from 'lucide-react'
import { supabase } from './supabase'
import { useAuth } from './AuthContext'
import { Avatar } from './ui'
import { playNotify } from './sounds'

export type Peer = { id: string; username: string; full_name: string; avatar_url: string | null }
type Kind = 'audio' | 'video'
type CallRow = { id: string; conversation_id: string; caller_id: string; callee_id: string; kind: Kind; status: string; created_at: string }
type Active = { id: string; kind: Kind; peer: Peer; cid: string; role: 'caller' | 'callee'; phase: 'calling' | 'connecting' | 'live'; note: string }
type Ctx = { startCall: (peer: Peer, cid: string, kind: Kind) => void }
const CallCtx = createContext<Ctx>({ startCall: () => {} })
export const useCall = () => useContext(CallCtx)

// STUN is free; add a TURN server (secrets VITE_TURN_*) so calls also work on mobile data.
function iceServers(): RTCIceServer[] {
  const s: RTCIceServer[] = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }]
  const u = import.meta.env.VITE_TURN_URL as string | undefined
  if (u) s.push({ urls: u.split(',').map(x => x.trim()).filter(Boolean), username: import.meta.env.VITE_TURN_USER as string, credential: import.meta.env.VITE_TURN_PASS as string })
  return s
}
const RING_MS = 45000
const fmt = (n: number) => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`

export function CallProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth(); const uid = session!.user.id
  const [incoming, setIncoming] = useState<{ row: CallRow; peer: Peer } | null>(null)
  const [active, setActive] = useState<Active | null>(null)
  const [localS, setLocalS] = useState<MediaStream | null>(null)
  const [remoteS, setRemoteS] = useState<MediaStream | null>(null)
  const [muted, setMuted] = useState(false); const [camOff, setCamOff] = useState(false); const [secs, setSecs] = useState(0)
  const [ns, setNs] = useState(true); const [remoteCamOff, setRemoteCamOff] = useState(false); const [torch, setTorch] = useState(false); const [fill, setFill] = useState(false); const [back, setBack] = useState(false)
  const pc = useRef<RTCPeerConnection | null>(null); const chan = useRef<any>(null); const rowCh = useRef<any>(null)
  const local = useRef<MediaStream | null>(null); const pendingIce = useRef<RTCIceCandidateInit[]>([]); const timer = useRef(0)
  const activeRef = useRef<Active | null>(null); const incomingRef = useRef<typeof incoming>(null); const facing = useRef<'user' | 'environment'>('user')
  activeRef.current = active; incomingRef.current = incoming

  const cleanup = useCallback((note?: string) => {
    window.clearTimeout(timer.current)
    try { pc.current?.close() } catch { /* ignore */ }
    pc.current = null
    local.current?.getTracks().forEach(t => t.stop()); local.current = null
    if (chan.current) { supabase.removeChannel(chan.current); chan.current = null }
    if (rowCh.current) { supabase.removeChannel(rowCh.current); rowCh.current = null }
    pendingIce.current = []; setLocalS(null); setRemoteS(null); setMuted(false); setCamOff(false); setSecs(0); setNs(true); setRemoteCamOff(false); setTorch(false); setFill(false); setBack(false); facing.current = 'user'
    delete document.body.dataset.call
    if (note) { setActive(a => (a ? { ...a, note } : a)); window.setTimeout(() => setActive(null), 1400) } else setActive(null)
  }, [])

  const setStatus = (id: string, status: string) => supabase.from('calls').update({ status, ...(status === 'accepted' ? { answered_at: new Date().toISOString() } : {}), ...(status === 'ended' ? { ended_at: new Date().toISOString() } : {}) }).eq('id', id).then(() => {})

  const media = async (kind: Kind) => {
    const s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 }, video: kind === 'video' ? { facingMode: facing.current } : false })
    local.current = s; setLocalS(s); return s
  }
  const makePc = (id: string, s: MediaStream) => {
    const p = new RTCPeerConnection({ iceServers: iceServers() })
    s.getTracks().forEach(t => p.addTrack(t, s))
    const rs = new MediaStream(); setRemoteS(rs)
    p.ontrack = e => { e.streams[0]?.getTracks().forEach(t => { if (!rs.getTracks().includes(t)) rs.addTrack(t) }); setRemoteS(new MediaStream(rs.getTracks())) }
    p.onicecandidate = e => { if (e.candidate) chan.current?.send({ type: 'broadcast', event: 'ice', payload: e.candidate.toJSON() }) }
    p.onconnectionstatechange = () => {
      if (p.connectionState === 'connected') { setActive(a => (a ? { ...a, phase: 'live', note: '' } : a)); window.clearTimeout(timer.current) }
      if (p.connectionState === 'failed') { setStatus(id, 'ended'); cleanup('Connection lost') }
    }
    pc.current = p; return p
  }
  const addIce = async (c: RTCIceCandidateInit) => { if (pc.current?.remoteDescription) { try { await pc.current.addIceCandidate(c) } catch { /* ignore */ } } else pendingIce.current.push(c) }
  const flushIce = async () => { const q = pendingIce.current; pendingIce.current = []; for (const c of q) { try { await pc.current?.addIceCandidate(c) } catch { /* ignore */ } } }
  const join = (id: string, onSub: () => void, handlers: Record<string, (p: any) => void>) => {
    let ch = supabase.channel('call-' + id, { config: { broadcast: { self: false } } })
    Object.entries(handlers).forEach(([ev, fn]) => { ch = ch.on('broadcast', { event: ev }, (m: any) => fn(m.payload)) })
    ch.subscribe((st: string) => { if (st === 'SUBSCRIBED') onSub() }); chan.current = ch
  }

  const startCall = useCallback(async (peer: Peer, cid: string, kind: Kind) => {
    if (activeRef.current || incomingRef.current) return
    document.body.dataset.call = '1'
    setActive({ id: '', kind, peer, cid, role: 'caller', phase: 'calling', note: 'Starting…' })
    let s: MediaStream
    try { s = await media(kind) } catch { cleanup('Microphone/camera permission needed'); return }
    const { data, error } = await supabase.from('calls').insert({ conversation_id: cid, caller_id: uid, callee_id: peer.id, kind }).select('id').single()
    if (error || !data) { cleanup('Could not start the call'); return }
    const id = (data as any).id as string
    setActive({ id, kind, peer, cid, role: 'caller', phase: 'calling', note: 'Calling…' })
    join(id, () => {}, {
      ready: async () => {
        if (pc.current) return   // only one connection, never two voices
        const p = makePc(id, s); setActive(a => (a ? { ...a, phase: 'connecting', note: 'Connecting…' } : a))
        const offer = await p.createOffer(); await p.setLocalDescription(offer)
        chan.current?.send({ type: 'broadcast', event: 'offer', payload: offer })
      },
      answer: async d => { if (pc.current?.signalingState !== 'have-local-offer') return; await pc.current.setRemoteDescription(d); flushIce() },
      ice: addIce,
      cam: p => setRemoteCamOff(!!p?.off),
      end: () => cleanup('Call ended')
    })
    rowCh.current = supabase.channel('callrow-' + id).on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'calls', filter: `id=eq.${id}` }, (p: any) => {
      const st = p.new?.status; if (st === 'declined') cleanup('Declined'); else if (st === 'busy') cleanup('Busy')
    }).subscribe()
    timer.current = window.setTimeout(() => { if (activeRef.current?.phase === 'calling') { setStatus(id, 'missed'); cleanup('No answer') } }, RING_MS)
  }, [uid])

  const accept = async () => {
    const inc = incomingRef.current; if (!inc) return
    const { row, peer } = inc; setIncoming(null); document.body.dataset.call = '1'
    setActive({ id: row.id, kind: row.kind, peer, cid: row.conversation_id, role: 'callee', phase: 'connecting', note: 'Connecting…' })
    let s: MediaStream
    try { s = await media(row.kind) } catch { setStatus(row.id, 'declined'); cleanup('Microphone/camera permission needed'); return }
    join(row.id, () => { chan.current?.send({ type: 'broadcast', event: 'ready', payload: {} }); setStatus(row.id, 'accepted') }, {
      offer: async d => { if (pc.current) return; const p = makePc(row.id, s); await p.setRemoteDescription(d); await flushIce(); const a = await p.createAnswer(); await p.setLocalDescription(a); chan.current?.send({ type: 'broadcast', event: 'answer', payload: a }) },
      ice: addIce,
      cam: p => setRemoteCamOff(!!p?.off),
      end: () => cleanup('Call ended')
    })
    timer.current = window.setTimeout(() => { if (activeRef.current?.phase !== 'live') { setStatus(row.id, 'ended'); cleanup('Could not connect') } }, 30000)
  }
  const decline = () => { const inc = incomingRef.current; if (inc) setStatus(inc.row.id, 'declined'); setIncoming(null) }
  const hangUp = () => {
    const a = activeRef.current; if (!a) return
    chan.current?.send({ type: 'broadcast', event: 'end', payload: {} })
    if (a.id) setStatus(a.id, a.phase === 'calling' ? 'missed' : 'ended')
    cleanup()
  }
  const toggleMic = () => { const on = !muted; local.current?.getAudioTracks().forEach(t => { t.enabled = !on }); setMuted(on) }
  const toggleCam = () => { const off = !camOff; local.current?.getVideoTracks().forEach(t => { t.enabled = !off }); setCamOff(off); chan.current?.send({ type: 'broadcast', event: 'cam', payload: { off } }) }
  const toggleNs = async () => {
    const on = !ns; setNs(on)
    try { await local.current?.getAudioTracks()[0]?.applyConstraints({ noiseSuppression: on, echoCancellation: true, autoGainControl: true }) } catch { /* not supported */ }
  }
  const flipCam = async () => {
    if (active?.kind !== 'video' || !local.current) return
    const next = facing.current === 'user' ? 'environment' : 'user'
    try {
      local.current.getVideoTracks().forEach(t => t.stop())            // phones allow only one camera at a time
      const ns2 = await navigator.mediaDevices.getUserMedia({ video: { facingMode: next } }); const nt = ns2.getVideoTracks()[0]
      nt.enabled = !camOff
      await pc.current?.getSenders().find(x => x.track?.kind === 'video' || x.track === null)?.replaceTrack(nt)
      local.current.getVideoTracks().forEach(t => local.current?.removeTrack(t)); local.current.addTrack(nt)
      facing.current = next; setBack(next === 'environment'); setTorch(false); setLocalS(new MediaStream(local.current.getTracks()))
    } catch { setErrNote('Could not switch camera') }
  }
  const toggleTorch = async () => {
    const tr = local.current?.getVideoTracks()[0]; const on = !torch
    try { await tr?.applyConstraints({ advanced: [{ torch: on } as any] }); setTorch(on) } catch { setErrNote('Flash is not available on this camera') }
  }
  const [note2, setNote2] = useState(''); const setErrNote = (m: string) => { setNote2(m); window.setTimeout(() => setNote2(''), 2200) }

  // incoming calls (live) + calls that rang while the app was closed (opened from the notification)
  useEffect(() => {
    const show = async (row: CallRow) => {
      if (activeRef.current || incomingRef.current) { setStatus(row.id, 'busy'); return }
      const { data: p } = await supabase.from('profiles').select('id,username,full_name,avatar_url').eq('id', row.caller_id).single()
      if (p) setIncoming({ row, peer: p as Peer })
    }
    const ch = supabase.channel('calls-in-' + uid)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'calls', filter: `callee_id=eq.${uid}` }, (p: any) => show(p.new as CallRow))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'calls', filter: `callee_id=eq.${uid}` }, (p: any) => {
        if (p.new?.status !== 'ringing' && incomingRef.current?.row.id === p.new?.id) setIncoming(null) })
      .subscribe()
    supabase.from('calls').select('*').eq('callee_id', uid).eq('status', 'ringing').gt('created_at', new Date(Date.now() - RING_MS).toISOString()).order('created_at', { ascending: false }).limit(1)
      .then(({ data }) => { if (data?.[0]) show(data[0] as CallRow) })
    return () => { supabase.removeChannel(ch) }
  }, [uid])

  // ringtone + vibration while a call is incoming; stop ringing after 45s
  useEffect(() => {
    if (!incoming) return
    playNotify(true); const r = window.setInterval(() => { playNotify(true); navigator.vibrate?.([400, 200, 400]) }, 2200)
    const t = window.setTimeout(() => setIncoming(null), RING_MS)
    return () => { window.clearInterval(r); window.clearTimeout(t) }
  }, [incoming?.row.id])
  useEffect(() => { if (active?.phase !== 'live') return; const i = window.setInterval(() => setSecs(s => s + 1), 1000); return () => window.clearInterval(i) }, [active?.phase])

  const lv = useRef<HTMLVideoElement>(null), rv = useRef<HTMLVideoElement>(null)
  useEffect(() => { if (lv.current) lv.current.srcObject = localS }, [localS, active?.id])
  useEffect(() => { if (rv.current) rv.current.srcObject = remoteS }, [remoteS, active?.id])

  const btn = 'grid h-14 w-14 place-items-center rounded-full'; const sm = 'grid h-11 w-11 place-items-center rounded-full'
  return (<CallCtx.Provider value={{ startCall }}>{children}
    {incoming && <div className="fixed inset-0 z-[95] flex flex-col items-center justify-between px-6 py-16 text-white" style={{ background: 'linear-gradient(160deg,#0e1127,#2a1b5a)' }}>
      <div className="flex flex-col items-center gap-3 pt-10"><Avatar a={incoming.peer} s={120} /><b className="text-2xl">{incoming.peer.full_name || incoming.peer.username}</b>
        <span className="text-white/70">Incoming {incoming.row.kind === 'video' ? 'video' : 'voice'} call…</span></div>
      <div className="flex w-full max-w-xs justify-between">
        <button onClick={decline} className={`${btn} bg-red-600`} aria-label="Decline"><PhoneOff /></button>
        <button onClick={accept} className={`${btn} animate-pulse bg-green-500`} aria-label="Accept">{incoming.row.kind === 'video' ? <Video /> : <Phone />}</button></div></div>}
    {active && <div className="fixed inset-0 z-[96] flex flex-col bg-black text-white">
      <video ref={rv} autoPlay playsInline className={active.kind === 'video' && remoteS ? 'absolute inset-0 h-full w-full object-cover' : 'absolute h-0 w-0'} />
      {(active.kind === 'audio' || !remoteS || active.phase !== 'live' || remoteCamOff) && <div className="absolute inset-0 flex flex-col items-center justify-center gap-3" style={{ background: 'linear-gradient(160deg,#0e1127,#2a1b5a)' }}>
        <Avatar a={active.peer} s={120} /><b className="text-2xl">{active.peer.full_name || active.peer.username}</b>
        <span className="text-white/70">{active.phase === 'live' ? (remoteCamOff ? `Camera off · ${fmt(secs)}` : fmt(secs)) : active.note || 'Connecting…'}</span></div>}
      {active.phase === 'live' && active.kind === 'video' && <span className="absolute left-0 right-0 top-0 p-4 pt-10 text-center text-sm text-white/90" style={{ textShadow: '0 1px 4px #000' }}>{active.peer.full_name || active.peer.username} · {fmt(secs)}</span>}
      {active.kind === 'video' && camOff && <div className="absolute right-3 top-16 grid h-40 w-28 place-items-center rounded-2xl border border-white/30 bg-neutral-900"><VideoOff className="text-white/70" /></div>}
      {active.kind === 'video' && localS && !camOff && <video ref={lv} autoPlay playsInline muted className="absolute right-3 top-16 h-40 w-28 -scale-x-100 rounded-2xl border border-white/30 bg-black object-cover shadow-xl" />}
      {fill && <div className="pointer-events-none absolute inset-0 z-10" style={{ boxShadow: 'inset 0 0 0 38px #fffbe6, inset 0 0 90px 40px rgba(255,251,230,.9)' }} />}
      {note2 && <span className="absolute inset-x-6 top-24 z-20 rounded-xl bg-black/70 p-2 text-center text-sm">{note2}</span>}
      <div className="absolute inset-x-0 bottom-0 z-20 flex flex-col items-center gap-4 p-5" style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}>
        <div className="flex items-center justify-center gap-3">
          <button onClick={toggleNs} className={`${sm} ${ns ? 'bg-green-500/80' : 'bg-white/20'}`} aria-label="Noise reduction" title="Noise reduction"><Waves size={20} /></button>
          {active.kind === 'video' && <button onClick={flipCam} className={`${sm} bg-white/20`} aria-label="Switch camera"><SwitchCamera size={20} /></button>}
          {active.kind === 'video' && back && <button onClick={toggleTorch} className={`${sm} ${torch ? 'bg-yellow-400 text-black' : 'bg-white/20'}`} aria-label="Flash"><Flashlight size={20} /></button>}
          {active.kind === 'video' && !back && <button onClick={() => setFill(f => !f)} className={`${sm} ${fill ? 'bg-yellow-200 text-black' : 'bg-white/20'}`} aria-label="Screen light"><Sun size={20} /></button>}</div>
        <div className="flex items-center justify-center gap-5">
          <button onClick={toggleMic} className={`${btn} ${muted ? 'bg-white text-black' : 'bg-white/20'}`} aria-label="Mute">{muted ? <MicOff /> : <Mic />}</button>
          {active.kind === 'video' && <button onClick={toggleCam} className={`${btn} ${camOff ? 'bg-white text-black' : 'bg-white/20'}`} aria-label="Camera">{camOff ? <VideoOff /> : <Video />}</button>}
          <button onClick={hangUp} className={`${btn} bg-red-600`} aria-label="End call"><PhoneOff /></button></div></div></div>}
  </CallCtx.Provider>)
}
