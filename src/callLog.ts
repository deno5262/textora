export type CallRow = { id: string; conversation_id: string | null; caller_id: string; callee_id: string; kind: 'audio' | 'video'; status: string; created_at: string; answered_at?: string | null; ended_at?: string | null }
export const fmtDur = (sec: number) => { const s = Math.max(0, Math.round(sec)); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60; const p = (n: number) => String(n).padStart(2, '0'); return h ? `${h}:${p(m)}:${p(r)}` : `${m}:${p(r)}` }
/** Human description of one call from the point of view of user `me`. */
export function describeCall(c: CallRow, me: string) {
  const outgoing = c.caller_id === me; const word = c.kind === 'video' ? 'video' : 'voice'
  const stale = c.status === 'ringing' && Date.now() - new Date(c.created_at).getTime() > 60000
  const status = stale ? 'missed' : c.status
  const dur = c.answered_at && c.ended_at ? (new Date(c.ended_at).getTime() - new Date(c.answered_at).getTime()) / 1000 : null
  let label: string; let missed = false
  if (c.answered_at && dur !== null) label = `${outgoing ? 'Outgoing' : 'Incoming'} ${word} call · ${fmtDur(dur)}`
  else if (status === 'missed') { label = outgoing ? `${word[0].toUpperCase() + word.slice(1)} call · No answer` : `Missed ${word} call`; missed = !outgoing }
  else if (status === 'declined') label = outgoing ? `${word[0].toUpperCase() + word.slice(1)} call · Declined` : `You declined a ${word} call`
  else if (status === 'busy') label = `${word[0].toUpperCase() + word.slice(1)} call · Busy`
  else if (status === 'ringing') label = outgoing ? `Calling…` : `Incoming ${word} call`
  else label = `${outgoing ? 'Outgoing' : 'Incoming'} ${word} call`
  const time = new Date(c.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  return { label, missed, outgoing, time, dur }
}
