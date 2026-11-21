export type CallRow = { id: string; conversation_id: string | null; caller_id: string; callee_id: string; kind: 'audio' | 'video'; status: string; created_at: string; answered_at?: string | null; ended_at?: string | null }
export const fmtDur = (sec: number) => { const s = Math.max(0, Math.round(sec)); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60; const p = (n: number) => String(n).padStart(2, '0'); return h ? `${h}:${p(m)}:${p(r)}` : `${m}:${p(r)}` }
/** Human description of one call from the point of view of user `me`. */
const durText = (sec: number) => { const s = Math.round(sec); if (s < 60) return `${s} sec`; const m = Math.floor(s / 60); return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min` }
/** Human description of one call from the point of view of user `me`. */
export function describeCall(c: CallRow, me: string) {
  const outgoing = c.caller_id === me; const word = c.kind === 'video' ? 'video' : 'voice'; const W = word[0].toUpperCase() + word.slice(1)
  const stale = c.status === 'ringing' && Date.now() - new Date(c.created_at).getTime() > 60000
  const status = stale ? 'missed' : c.status
  const dur = c.answered_at && c.ended_at ? (new Date(c.ended_at).getTime() - new Date(c.answered_at).getTime()) / 1000 : null
  let title = `${W} call`; let sub = ''; let missed = false
  if (c.answered_at && dur !== null) sub = durText(dur)
  else if (status === 'missed') { if (outgoing) sub = 'No answer'; else { title = `Missed ${word} call`; sub = 'Tap to call back'; missed = true } }
  else if (status === 'declined') sub = outgoing ? 'Declined' : 'Tap to call back'
  else if (status === 'busy') sub = 'Busy'
  else if (status === 'ringing') sub = outgoing ? 'Calling…' : 'Ringing…'
  const time = new Date(c.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  return { title, sub, label: sub ? `${title} · ${sub}` : title, missed, outgoing, time, dur }
}
