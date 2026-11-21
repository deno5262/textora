import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Trophy } from 'lucide-react'
import { supabase } from './supabase'
import { useAuth } from './AuthContext'
import { Avatar } from './ui'
import RankBadge from './RankBadge'
import { daysLeftInSeason, rankFor, seasonKey, seasonName } from './rank'

type Row = { user_id: string; season_points: number; level: number }
type P = { id: string; username: string; full_name: string; avatar_url: string | null }
export default function Ranking() {
  const { session } = useAuth(); const uid = session!.user.id
  const [rows, setRows] = useState<Row[] | null>(null); const [people, setPeople] = useState<Record<string, P>>({}); const [mine, setMine] = useState<{ pos: number; pts: number } | null>(null)
  useEffect(() => { (async () => {
    const { data } = await supabase.from('user_stats').select('user_id,season_points,level').eq('season', seasonKey()).gt('season_points', 0).order('season_points', { ascending: false }).limit(50)
    const list = (data ?? []) as Row[]; setRows(list)
    const ids = list.map(r => r.user_id); if (ids.length) { const { data: ps } = await supabase.from('profiles').select('id,username,full_name,avatar_url').in('id', ids); setPeople(Object.fromEntries(((ps ?? []) as P[]).map(p => [p.id, p]))) }
    const me = list.findIndex(r => r.user_id === uid)
    if (me >= 0) setMine({ pos: me + 1, pts: list[me].season_points })
    else { const m = await supabase.from('user_stats').select('season_points').eq('user_id', uid).eq('season', seasonKey()).maybeSingle(); const pts = (m.data as any)?.season_points ?? 0
      if (pts > 0) { const { count } = await supabase.from('user_stats').select('user_id', { count: 'exact', head: true }).eq('season', seasonKey()).gt('season_points', pts); setMine({ pos: (count ?? 0) + 1, pts }) } }
  })() }, [])
  const medal = (i: number) => (i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : String(i + 1))
  return (<div className="flex flex-col gap-3 p-4">
    <div className="flex items-center gap-3"><Link to="/textora/menu" aria-label="Back" className="p-1"><ArrowLeft /></Link><h2 className="text-2xl font-black">Ranking</h2></div>
    <div className="rounded-2xl border border-line bg-surface p-4 text-center"><Trophy className="mx-auto mb-1 text-yellow-400" /><b>{seasonName()} season</b><p className="text-xs text-mute">Ends in {daysLeftInSeason()} days. Points reset every month. Grandmaster players receive special rewards.</p>
      {mine && <p className="mt-2 text-sm">You are <b>#{mine.pos}</b> with <b>{mine.pts.toLocaleString()}</b> points</p>}</div>
    {!rows && <p className="py-8 text-center text-mute">Loading…</p>}
    {rows && !rows.length && <p className="py-8 text-center text-mute">No one has points yet this month. Start chatting!</p>}
    <div className="divide-y divide-line overflow-hidden rounded-2xl bg-surface empty:hidden">{rows?.map((r, i) => { const p = people[r.user_id]; return (
      <Link key={r.user_id} to={p ? `/textora/u/${p.username}` : '#'} className={`flex items-center gap-3 px-4 py-3 ${r.user_id === uid ? 'bg-bg' : ''}`}>
        <span className="w-7 text-center font-bold">{medal(i)}</span>{p ? <Avatar a={p} s={42} /> : <span className="h-10 w-10 rounded-full bg-bg" />}
        <span className="min-w-0 flex-1"><b className="block truncate">{p?.full_name || p?.username || 'Player'}</b><span className="text-xs text-mute">Level {r.level} · {r.season_points.toLocaleString()} pts</span></span>
        <RankBadge tier={rankFor(r.season_points).name} size={13} /></Link>) })}</div></div>)
}
