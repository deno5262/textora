import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Briefcase, Cake, Calendar, Camera, Check, ChevronDown, ChevronLeft, ChevronRight, Copy, Droplet, Facebook, Globe, GraduationCap, Heart, Home, Instagram, MapPin, Music2, Phone, Send, Star, ThumbsUp, Trophy, Twitter, Youtube } from 'lucide-react'
import { supabase } from './supabase'
import { useAuth } from './AuthContext'
import { uploadProfileImage } from './image'
import { REL } from './EditProfile'
import { countryFlag, countryName } from './countries'
import { SOC, safeUrl } from './socials'
import { FriendPlus, useFriendState } from './friendState'
import RankBadge, { RankEmblem } from './RankBadge'
import { MessageButton } from './Textora'
import { daysLeftInSeason, MAX_LEVEL, monthLabel, pointsNow, rankFor, seasonName, seasonSummary, SeasonRow, starInfo, useStats, xpNeeded } from './rank'
import { short } from './ui'

const SOC_ICON: Record<string, typeof Globe> = { facebook: Facebook, instagram: Instagram, youtube: Youtube, tiktok: Music2, x: Twitter, whatsapp: Phone, telegram: Send, website: Globe }

const Stars = ({ name, pts, color }: { name: string; pts: number; color: string }) => {
  const s = starInfo(name, pts)
  return s.open ? <span className="flex items-center gap-1 text-sm font-bold" style={{ color }}><Star size={14} fill={color} />× {s.filled}</span>
    : <span className="flex gap-0.5">{Array.from({ length: s.total }).map((_, i) => <Star key={i} size={14} color={color} fill={i < s.filled ? color : 'none'} />)}</span>
}
const Tile = ({ label, children }: { label: string; children: React.ReactNode }) => <div className="flex flex-col items-center gap-1 rounded-2xl bg-bg p-3 text-center"><span className="text-[11px] uppercase tracking-wide text-mute">{label}</span><span className="text-lg font-bold">{children}</span></div>

export default function Profile() {
  const { profile: me, session, refresh } = useAuth(); const { username } = useParams(); const uid = session!.user.id; const nav = useNavigate()
  const own = !username || username === me?.username
  const [other, setOther] = useState<any | null | undefined>(undefined)
  const [friends, setFriends] = useState(0); const [likes, setLikes] = useState(0); const [iLike, setILike] = useState(false); const [hist, setHist] = useState<SeasonRow[]>([])
  const [aboutOpen, setAboutOpen] = useState(false); const [socOpen, setSocOpen] = useState(false); const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const av = useRef<HTMLInputElement>(null), cv = useRef<HTMLInputElement>(null)
  useEffect(() => { setOther(undefined); if (own) return; supabase.from('profiles').select('*').eq('username', username).maybeSingle().then(({ data }) => setOther(data ?? null)) }, [username, own])
  const profile: any = own ? me : other; const pid: string | undefined = profile?.id
  const stats = useStats(pid, own); const fs = useFriendState(own ? undefined : pid)
  const load = async () => {
    if (!pid) return
    const [c, l, h] = await Promise.all([supabase.rpc('profile_counts', { uid: pid }), supabase.from('profile_likes').select('liker_id', { count: 'exact', head: true }).eq('profile_id', pid), supabase.from('season_history').select('season,points,tier').eq('user_id', pid).order('season', { ascending: true })])
    setFriends(Number((c.data as any)?.[0]?.friends ?? 0)); setLikes(l.count ?? 0); setHist((h.data ?? []) as SeasonRow[])
    if (!own) { const x = await supabase.from('profile_likes').select('liker_id').eq('profile_id', pid).eq('liker_id', uid).maybeSingle(); setILike(!!x.data) }
  }
  useEffect(() => { load() }, [pid])
  if (!own && other === undefined) return <p className="py-10 text-center text-mute">Loading…</p>
  if (!profile) return <p className="py-10 text-center text-mute">{own ? 'Loading profile…' : 'This profile does not exist.'}</p>

  const name = profile.full_name || profile.username
  const lvl = stats?.level ?? 1; const need = xpNeeded(lvl); const xpIn = stats?.xp_in_level ?? 0; const lvlPct = lvl >= MAX_LEVEL ? 100 : Math.min(100, (xpIn / need) * 100)
  const pts = stats ? pointsNow(stats) : 0; const rk = rankFor(pts); const sum = seasonSummary(hist, pts)
  const R = 50, C = 2 * Math.PI * R
  const pick = (kind: 'avatar' | 'cover') => async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; e.target.value = ''; if (!f) return
    setErr(''); setBusy(true); try { await uploadProfileImage(uid, kind, f); await refresh() } catch (x) { setErr((x as Error).message) } setBusy(false)
  }
  const toggleLike = async () => {
    if (own) return; const on = !iLike; setILike(on); setLikes(n => n + (on ? 1 : -1))
    const r = on ? await supabase.from('profile_likes').insert({ profile_id: pid, liker_id: uid }) : await supabase.from('profile_likes').delete().eq('profile_id', pid).eq('liker_id', uid)
    if (r.error) { setILike(!on); setLikes(n => n + (on ? -1 : 1)); setErr(r.error.message) }
  }
  const copyId = async () => { if (!stats?.public_id) return; try { await navigator.clipboard.writeText(stats.public_id); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { setErr('Could not copy') } }
  const socials = Object.entries((profile.socials ?? {}) as Record<string, string>).filter(([k, v]) => safeUrl(v) && SOC.some(s => s[0] === k))
  const mapLink = profile.lat != null && profile.lng != null ? `https://www.openstreetmap.org/?mlat=${profile.lat}&mlon=${profile.lng}#map=13/${profile.lat}/${profile.lng}` : profile.living_in ? `https://www.openstreetmap.org/search?query=${encodeURIComponent(profile.living_in + ' ' + countryName(profile.country))}` : ''
  const rows = ([[MapPin, 'Lives in', profile.living_in || profile.location || '', mapLink], [Home, 'From', profile.hometown || ''], [Globe, 'Country', profile.country ? `${countryFlag(profile.country)} ${countryName(profile.country)}` : ''],
    [Heart, 'Relationship', profile.relationship_status ? REL[profile.relationship_status] : ''], [GraduationCap, 'Education', profile.education || ''], [Briefcase, 'Work', profile.work || ''],
    [Cake, 'Born', profile.birth_year ? String(profile.birth_year) : ''], [Droplet, 'Blood group', profile.blood_group ? profile.blood_group + (profile.is_blood_donor ? ' · donor' : '') : ''],
    [Calendar, 'Joined', profile.created_at ? new Date(profile.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long' }) : '']] as [typeof Home, string, string, string?][]).filter(r => r[2])

  return (<div className="-mx-4 -mt-4 pb-8">
    <div className="relative h-36 bg-surface">{profile.cover_url && <img src={profile.cover_url} alt="" className="h-full w-full object-cover" />}
      <div className="absolute inset-0" style={{ background: `linear-gradient(to top, var(--bg), transparent 70%), linear-gradient(120deg, ${rk.color}44, transparent)` }} />
      <button onClick={() => nav(-1)} aria-label="Back" className="absolute left-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-bg/80"><ArrowLeft size={20} /></button>
      {own && <button onClick={() => cv.current?.click()} className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-bg/80 px-3 py-1.5 text-sm"><Camera size={16} />Edit Cover</button>}</div>
    <input ref={av} type="file" accept="image/*" hidden onChange={pick('avatar')} /><input ref={cv} type="file" accept="image/*" hidden onChange={pick('cover')} />

    {/* ---- player card ---- */}
    <div className="relative z-10 mx-3 -mt-14 overflow-hidden rounded-3xl border bg-surface" style={{ borderColor: `${rk.color}88`, boxShadow: `0 12px 40px ${rk.color}33` }}>
      <div className="flex items-center gap-3 p-4" style={{ background: `linear-gradient(120deg, ${rk.color}, ${rk.color}55 60%, transparent)` }}>
        <div className="relative h-24 w-24 shrink-0">
          <svg viewBox="0 0 120 120" className="absolute inset-0 -rotate-90"><circle cx="60" cy="60" r={R} fill="none" stroke="#0006" strokeWidth="6" /><circle cx="60" cy="60" r={R} fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - lvlPct / 100)} /></svg>
          <div className="absolute inset-2.5 overflow-hidden rounded-full border-2 border-bg bg-surface">{profile.avatar_url ? <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" /> : <span className="grid h-full place-items-center text-3xl font-bold">{name[0]?.toUpperCase()}</span>}</div>
          <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/80 px-2 py-0.5 text-[11px] font-bold text-white">Lv {lvl}</span>
          <div className="absolute -right-1 bottom-2">{own ? <button onClick={() => av.current?.click()} aria-label="Change photo" className="grid h-8 w-8 place-items-center rounded-full border-2 border-bg bg-accent text-on"><Camera size={15} /></button> : <FriendPlus f={fs} size={32} />}</div></div>
        <div className="min-w-0 flex-1 text-white" style={{ textShadow: '0 1px 4px #0008' }}>
          <h1 className="flex items-center gap-2 truncate text-xl font-extrabold">{name}{profile.is_blood_donor && <Droplet size={16} className="shrink-0 fill-red-500 text-red-500" aria-label="Blood donor" />}</h1>
          <p className="truncate text-sm opacity-90">@{profile.username}</p>
          {stats?.public_id && <button onClick={copyId} className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-black/40 px-2.5 py-0.5 text-[11px]">UID <b className="tracking-wider">{stats.public_id}</b>{copied ? <Check size={12} /> : <Copy size={12} />}</button>}</div>
        <button onClick={toggleLike} disabled={own} aria-label="Like profile" className="flex shrink-0 flex-col items-center gap-0.5 rounded-2xl bg-black/35 px-3 py-2 text-white disabled:opacity-100"><ThumbsUp size={20} fill={iLike ? '#fff' : 'none'} /><b className="text-sm">{short(likes)}</b></button></div>
      {fs.fr.kind === 'sent' && <p className="bg-bg/60 px-4 py-1.5 text-center text-xs text-mute">Friend request sent. Tap the clock to cancel.</p>}
      {fs.fr.kind === 'received' && <p className="bg-bg/60 px-4 py-1.5 text-center text-xs text-mute">{name} sent you a friend request.</p>}
      {fs.msg && <p role="alert" className="px-4 py-1.5 text-center text-xs text-red-400">{fs.msg}</p>}

      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-center gap-4"><RankEmblem tier={rk.name} size={68} />
          <div className="min-w-0 flex-1"><p className="text-xs uppercase tracking-wide text-mute">{seasonName()}</p><b className="text-xl" style={{ color: rk.color }}>{rk.name}</b><div className="mt-0.5"><Stars name={rk.name} pts={pts} color={rk.color} /></div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-bg"><div className="h-full rounded-full transition-all duration-700" style={{ width: `${rk.pct}%`, background: rk.color }} /></div>
            <p className="mt-1 text-[11px] text-mute">{pts.toLocaleString()} pts{rk.next ? ` · ${(rk.next[1] - pts).toLocaleString()} to ${rk.next[0]}` : ''} · {daysLeftInSeason()}d left</p></div></div>
        <div>
          <div className="mb-1 flex items-baseline justify-between"><b>Level {lvl}</b><span className="text-xs text-mute">{lvl >= MAX_LEVEL ? 'MAX' : `${xpIn} / ${need} XP`}</span></div>
          <div className="h-2.5 overflow-hidden rounded-full bg-bg"><div className="h-full rounded-full transition-all duration-700" style={{ width: `${lvlPct}%`, background: 'linear-gradient(90deg, var(--accent), var(--accent2))' }} /></div></div>
        <div className="grid grid-cols-3 gap-2">
          <Tile label="Highest rank">{sum.best ? <RankBadge tier={sum.best} size={12} /> : '—'}</Tile>
          <Tile label="Heroic +">{sum.heroic}<span className="text-xs font-normal text-mute"> seasons</span></Tile>
          <Tile label="Grandmaster">{sum.grand}<span className="text-xs font-normal text-mute">×</span></Tile>
          <Tile label="Seasons">{sum.played}</Tile>
          <Tile label="Playing since">{sum.since ? monthLabel(sum.since) : '—'}</Tile>
          <Tile label="Friends">{friends}</Tile></div>
        <div><p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-mute">Season history</p>
          {sum.all.length ? <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">{[...sum.all].reverse().map(h => { const k = rankFor(h.points); return (
            <div key={h.season} className="flex w-28 shrink-0 flex-col items-center gap-1 rounded-2xl bg-bg p-2.5 text-center"><span className="text-[11px] text-mute">{monthLabel(h.season)}</span><RankEmblem tier={h.tier} size={36} /><span className="text-xs font-bold" style={{ color: k.color }}>{h.tier}</span><span className="text-[10px] text-mute">{h.points.toLocaleString()} pts</span></div>) })}</div>
            : <p className="rounded-2xl bg-bg p-3 text-center text-xs text-mute">No past seasons yet. Rank resets every month.</p>}</div>
        <Link to="/textora/ranking" className="flex items-center justify-center gap-2 rounded-xl border border-line py-2 text-sm font-semibold"><Trophy size={16} />Leaderboard</Link></div></div>

    <div className="px-4">
      {busy && <p className="mt-2 text-sm text-mute">Uploading…</p>}{err && <p role="alert" className="mt-2 text-sm text-red-400">{err}</p>}
      {profile.bio && <p className="mt-3">{profile.bio}</p>}
      {(profile.living_in || profile.location || profile.tagline) && <p className="mt-1 flex flex-wrap items-center gap-x-3 text-sm text-mute">{(profile.living_in || profile.location) && <span className="flex items-center gap-1"><MapPin size={14} />{profile.living_in || profile.location}</span>}{profile.tagline && <span className="italic">{profile.tagline}</span>}</p>}
      <div className="mt-3 flex items-center gap-2">
        <button onClick={() => setAboutOpen(!aboutOpen)} className="flex items-center gap-1 rounded-full border border-line bg-surface px-3 py-1.5 text-sm">About<ChevronDown size={16} className={aboutOpen ? 'rotate-180' : ''} /></button>
        {socials.length > 0 && <div className="flex items-center gap-1 rounded-full border border-line bg-surface px-1 py-1">
          <button aria-label="Social links" onClick={() => setSocOpen(!socOpen)} className="p-1">{socOpen ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}</button>
          {!socOpen && (() => { const Ic = SOC_ICON[socials[0][0]] ?? Globe; return <Ic size={16} className="mr-1 text-accent" /> })()}
          {socOpen && socials.map(([k, v]) => { const Ic = SOC_ICON[k] ?? Globe; return <a key={k} href={safeUrl(v)} target="_blank" rel="noopener noreferrer" aria-label={k} className="p-1 text-accent"><Ic size={18} /></a> })}</div>}</div>
      {aboutOpen && <div className="mt-3 flex flex-col gap-2 rounded-2xl border border-line bg-surface p-3"><b>About</b>
        {rows.length ? <ul className="flex flex-col gap-2">{rows.map(([I, k, v, href]) => <li key={k} className="flex items-center gap-3"><I size={18} className="shrink-0 text-accent" /><span className="text-mute">{k}:</span>{href ? <a href={href} target="_blank" rel="noreferrer" className="min-w-0 break-words underline decoration-accent">{v}</a> : <span className="min-w-0 break-words">{v}</span>}</li>)}</ul> : <p className="text-mute">No details added yet.</p>}</div>}
      <div className="mt-4">{own
        ? <div className="flex gap-2"><Link to="/textora/edit-profile" className="flex-1 rounded-xl bg-accent px-4 py-2.5 text-center font-semibold text-on">Edit profile</Link><Link to="/textora/find" className="flex-1 rounded-xl border border-line px-4 py-2.5 text-center font-semibold">Find people</Link></div>
        : <MessageButton target={profile.id} />}</div>
    </div></div>)
}
