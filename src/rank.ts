import { useEffect, useState } from 'react'
import { supabase } from './supabase'

/* ---- Level: XP inside a level. Early levels are quick, later ones get very long (mirrors xp_needed() in SQL) ---- */
export const MAX_LEVEL = 100
export const xpNeeded = (l: number) => 20 + 6 * l + Math.trunc(0.02 * l * l * l)

/* ---- Monthly rank (resets every month). Points = XP earned this month ---- */
export const TIERS: [string, number][] = [
  ['Bronze I', 0], ['Bronze II', 150], ['Bronze III', 350],
  ['Silver I', 600], ['Silver II', 900], ['Silver III', 1300],
  ['Gold I', 1800], ['Gold II', 2400], ['Gold III', 3100], ['Gold IV', 3900],
  ['Platinum I', 4800], ['Platinum II', 5800], ['Platinum III', 7000], ['Platinum IV', 8400],
  ['Diamond I', 10000], ['Diamond II', 12000], ['Diamond III', 14000], ['Diamond IV', 16500],
  ['Heroic', 19500], ['Grandmaster', 24000]]
export const FAMILY_COLORS: Record<string, string> = { Bronze: '#cd7f32', Silver: '#c0c8d0', Gold: '#ffc107', Platinum: '#5fd4e0', Diamond: '#4fc3ff', Heroic: '#ff4d4d', Grandmaster: '#d946ef' }
export const familyOf = (tier: string) => tier.split(' ')[0]
export function rankFor(points: number) {
  let i = 0; for (let k = 0; k < TIERS.length; k++) if (points >= TIERS[k][1]) i = k
  const name = TIERS[i][0]; const next = TIERS[i + 1]; const family = familyOf(name)
  const pct = next ? Math.min(100, ((points - TIERS[i][1]) / (next[1] - TIERS[i][1])) * 100) : 100
  return { name, family, color: FAMILY_COLORS[family], next, pct }
}
export const seasonKey = () => new Date().toISOString().slice(0, 7)
export const seasonName = () => new Date().toLocaleDateString([], { month: 'long', year: 'numeric' })
export const daysLeftInSeason = () => { const n = new Date(); return Math.max(0, Math.ceil((Date.UTC(n.getUTCFullYear(), n.getUTCMonth() + 1, 1) - n.getTime()) / 864e5)) }

export type Stats = { user_id: string; public_id: string | null; level: number; xp_in_level: number; total_xp: number; season: string; season_points: number }
export const emptyStats = (id: string): Stats => ({ user_id: id, public_id: null, level: 1, xp_in_level: 0, total_xp: 0, season: seasonKey(), season_points: 0 })
export const pointsNow = (s: Stats) => (s.season === seasonKey() ? s.season_points : 0)

/** Loads someone's level and monthly rank. For your own profile it also makes sure your public ID exists. */
export function useStats(userId: string | undefined, own: boolean) {
  const [s, setS] = useState<Stats | null>(null)
  useEffect(() => {
    if (!userId) return; let dead = false; setS(null)
    ;(async () => {
      let { data } = await supabase.from('user_stats').select('*').eq('user_id', userId).maybeSingle()
      if (!data && own) { await supabase.rpc('ensure_my_stats'); data = (await supabase.from('user_stats').select('*').eq('user_id', userId).maybeSingle()).data }
      if (!dead) setS((data as Stats) ?? emptyStats(userId))
    })()
    return () => { dead = true }
  }, [userId, own])
  return s
}

/* ---- helpers for the player card ---- */
export const tierIndex = (name: string) => TIERS.findIndex(t => t[0] === name)
const ROMAN: Record<string, number> = { I: 1, II: 2, III: 3, IV: 4 }
/** Stars shown under the rank. Numbered tiers show I-IV as 1-4 stars; Heroic and Grandmaster keep adding stars as points grow. */
export function starInfo(name: string, points: number) {
  const fam = familyOf(name); const part = name.split(' ')[1]
  if (fam === 'Heroic' || fam === 'Grandmaster') { const base = TIERS[tierIndex(name)][1]; return { filled: 1 + Math.floor(Math.max(0, points - base) / 400), total: 0, open: true } }
  return { filled: ROMAN[part] ?? 1, total: TIERS.filter(t => familyOf(t[0]) === fam).length, open: false }
}
export type SeasonRow = { season: string; points: number; tier: string }
export function seasonSummary(history: SeasonRow[], currentPoints: number) {
  const all = [...history]; if (currentPoints > 0 && !all.some(h => h.season === seasonKey())) all.push({ season: seasonKey(), points: currentPoints, tier: rankFor(currentPoints).name })
  all.sort((a, b) => (a.season < b.season ? -1 : 1))
  const heroicAt = tierIndex('Heroic')
  const best = all.reduce<string | null>((b, h) => (b === null || tierIndex(h.tier) > tierIndex(b) ? h.tier : b), null)
  return { all, best, heroic: all.filter(h => tierIndex(h.tier) >= heroicAt).length, grand: all.filter(h => h.tier === 'Grandmaster').length, played: all.length, since: all[0]?.season ?? null }
}
export const monthLabel = (ym: string) => new Date(ym + '-01T00:00:00Z').toLocaleDateString([], { month: 'short', year: 'numeric', timeZone: 'UTC' })
