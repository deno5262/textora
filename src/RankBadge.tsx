import { Crown, Flame, Gem, Medal, Shield } from 'lucide-react'
import { familyOf, FAMILY_COLORS } from './rank'
const ICON: Record<string, typeof Medal> = { Bronze: Medal, Silver: Medal, Gold: Medal, Platinum: Shield, Diamond: Gem, Heroic: Flame, Grandmaster: Crown }
export default function RankBadge({ tier, size = 16 }: { tier: string; size?: number }) {
  const f = familyOf(tier); const c = FAMILY_COLORS[f] ?? '#cd7f32'; const I = ICON[f] ?? Medal
  return <span title={tier} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-sm font-semibold" style={{ color: c, border: `1px solid ${c}`, background: `${c}22` }}><I size={size} fill={c} fillOpacity={0.35} />{tier}</span>
}
