import { Crown, Flame, Gem, Medal, Shield } from 'lucide-react'
import { familyOf, FAMILY_COLORS } from './rank'
const ICON: Record<string, typeof Medal> = { Bronze: Medal, Silver: Medal, Gold: Medal, Platinum: Shield, Diamond: Gem, Heroic: Flame, Grandmaster: Crown }
export default function RankBadge({ tier, size = 16 }: { tier: string; size?: number }) {
  const f = familyOf(tier); const c = FAMILY_COLORS[f] ?? '#cd7f32'; const I = ICON[f] ?? Medal
  return <span title={tier} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-sm font-semibold" style={{ color: c, border: `1px solid ${c}`, background: `${c}22` }}><I size={size} fill={c} fillOpacity={0.35} />{tier}</span>
}

/** Big glowing emblem for the player card. */
export function RankEmblem({ tier, size = 64 }: { tier: string; size?: number }) {
  const f = familyOf(tier); const c = FAMILY_COLORS[f] ?? '#cd7f32'; const I = ICON[f] ?? Medal
  return <span className="grid shrink-0 place-items-center rounded-full" style={{ width: size, height: size, background: `radial-gradient(circle at 30% 30%, ${c}, ${c}66 65%, #000 120%)`, boxShadow: `0 0 22px ${c}77, inset 0 0 12px #0009` }}><I size={size * 0.5} color="#fff" fill="#fff" fillOpacity={0.25} /></span>
}
