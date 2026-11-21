import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Briefcase, Cake, Calendar, Camera, Check, ChevronDown, ChevronLeft, ChevronRight, Copy, Droplet, Facebook, Globe, GraduationCap, Heart, Home, Instagram, MapPin, Music2, Phone, Plus, Send, Trophy, Twitter, Youtube } from 'lucide-react'
import { supabase } from './supabase'
import { useAuth } from './AuthContext'
import { uploadProfileImage } from './image'
import { REL } from './EditProfile'
import { countryFlag, countryName } from './countries'
import { SOC, safeUrl } from './socials'
import RelationButtons from './Relation'
import RankBadge from './RankBadge'
import { MessageButton } from './Textora'
import { daysLeftInSeason, MAX_LEVEL, pointsNow, rankFor, seasonName, useStats, xpNeeded } from './rank'
import { short } from './ui'

const SOC_ICON: Record<string, typeof Globe> = { facebook: Facebook, instagram: Instagram, youtube: Youtube, tiktok: Music2, x: Twitter, whatsapp: Phone, telegram: Send, website: Globe }

export default function Profile() {
  const { profile: me, session, refresh } = useAuth(); const { username } = useParams(); const uid = session!.user.id; const nav = useNavigate()
  const own = !username || username === me?.username
  const [other, setOther] = useState<any | null | undefined>(undefined)
  const [c, setC] = useState({ followers: 0, following: 0, friends: 0 }); const [iFollow, setIFollow] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false); const [socOpen, setSocOpen] = useState(false); const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const av = useRef<HTMLInputElement>(null), cv = useRef<HTMLInputElement>(null)
  useEffect(() => { setOther(undefined); if (own) return; supabase.from('profiles').select('*').eq('username', username).maybeSingle().then(({ data }) => setOther(data ?? null)) }, [username, own])
  const profile: any = own ? me : other; const pid: string | undefined = profile?.id
  const stats = useStats(pid, own)
  const loadCounts = async () => {
    if (!pid) return
    const r = await supabase.rpc('profile_counts', { uid: pid }); const x: any = r.data?.[0] ?? {}
    setC({ followers: Number(x.followers ?? 0), following: Number(x.following ?? 0), friends: Number(x.friends ?? 0) })
    if (!own) { const f = await supabase.from('follows').select('follower_id').eq('follower_id', uid).eq('following_id', pid).maybeSingle(); setIFollow(!!f.data) }
  }
  useEffect(() => { loadCounts() }, [pid])
  if (!own && other === undefined) return <p className="py-10 text-center text-mute">Loading…</p>
  if (!profile) return <p className="py-10 text-center text-mute">{own ? 'Loading profile…' : 'This profile does not exist.'}</p>

  const name = profile.full_name || profile.username
  const lvl = stats?.level ?? 1; const need = xpNeeded(lvl); const xpIn = stats?.xp_in_level ?? 0; const lvlPct = lvl >= MAX_LEVEL ? 100 : Math.min(100, (xpIn / need) * 100)
  const pts = stats ? pointsNow(stats) : 0; const rk = rankFor(pts)
  const R = 54, C = 2 * Math.PI * R
  const pick = (kind: 'avatar' | 'cover') => async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; e.target.value = ''; if (!f) return
    setErr(''); setBusy(true); try { await uploadProfileImage(uid, kind, f); await refresh() } catch (x) { setErr((x as Error).message) } setBusy(false)
  }
  const followNow = async () => { if (iFollow) return; const r = await supabase.from('follows').insert({ follower_id: uid, following_id: profile.id }); if (r.error) setErr(r.error.message); else { setIFollow(true); loadCounts() } }
  const copyId = async () => { if (!stats?.public_id) return; try { await navigator.clipboard.writeText(stats.public_id); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { setErr('Could not copy') } }
  const socials = Object.entries((profile.socials ?? {}) as Record<string, string>).filter(([k, v]) => safeUrl(v) && SOC.some(s => s[0] === k))
  const mapLink = profile.lat != null && profile.lng != null ? `https://www.openstreetmap.org/?mlat=${profile.lat}&mlon=${profile.lng}#map=13/${profile.lat}/${profile.lng}` : profile.living_in ? `https://www.openstreetmap.org/search?query=${encodeURIComponent(profile.living_in + ' ' + countryName(profile.country))}` : ''
  const rows = ([[MapPin, 'Lives in', profile.living_in || profile.location || '', mapLink], [Home, 'From', profile.hometown || ''], [Globe, 'Country', profile.country ? `${countryFlag(profile.country)} ${countryName(profile.country)}` : ''],
    [Heart, 'Relationship', profile.relationship_status ? REL[profile.relationship_status] : ''], [GraduationCap, 'Education', profile.education || ''], [Briefcase, 'Work', profile.work || ''],
    [Cake, 'Born', profile.birth_year ? String(profile.birth_year) : ''], [Droplet, 'Blood group', profile.blood_group ? profile.blood_group + (profile.is_blood_donor ? ' · donor' : '') : ''],
    [Calendar, 'Joined', profile.created_at ? new Date(profile.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long' }) : '']] as [typeof Home, string, string, string?][]).filter(r => r[2])
  const stat = (n: number, l: string, kind?: string) => { const inner = <><b className="text-ink">{short(n)}</b> <span className="text-mute">{l}</span></>; return kind ? <Link to={`/textora/u/${profile.username}/list/${kind}`} className="active:opacity-60">{inner}</Link> : <span>{inner}</span> }

  return (<div className="-mx-4 -mt-4 pb-6">
    <div className="relative h-44 bg-surface">{profile.cover_url && <img src={profile.cover_url} alt="" className="h-full w-full object-cover" />}
      <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, var(--bg), transparent 55%)' }} />
      <button onClick={() => nav(-1)} aria-label="Back" className="absolute left-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-bg/80"><ArrowLeft size={20} /></button>
      {own && <button onClick={() => cv.current?.click()} className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-bg/80 px-3 py-1.5 text-sm"><Camera size={16} />Edit Cover</button>}</div>
    <div className="px-4">
      <div className="-mt-14 flex items-end gap-3">
        <div className="relative h-28 w-28 shrink-0">
          <svg viewBox="0 0 120 120" className="absolute inset-0 -rotate-90"><circle cx="60" cy="60" r={R} fill="none" stroke="var(--line)" strokeWidth="5" />
            <circle cx="60" cy="60" r={R} fill="none" stroke={rk.color} strokeWidth="5" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - lvlPct / 100)} /></svg>
          <div className="absolute inset-2 overflow-hidden rounded-full border-2 border-bg bg-surface">{profile.avatar_url ? <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" /> : <span className="grid h-full place-items-center text-3xl font-bold">{name[0]?.toUpperCase()}</span>}</div>
          {own ? <button onClick={() => av.current?.click()} aria-label="Change photo" className="absolute bottom-0 right-0 rounded-full bg-accent p-1.5 text-on"><Camera size={16} /></button>
            : <button onClick={followNow} aria-label={iFollow ? 'Following' : 'Follow'} className="absolute bottom-0 right-0 grid h-8 w-8 place-items-center rounded-full border-2 border-bg bg-accent text-on">{iFollow ? <Check size={16} /> : <Plus size={18} />}</button>}</div>
        <div className="min-w-0 flex-1 pb-1">
          <h1 className="flex items-center gap-2 truncate text-xl font-bold">{name}{profile.is_blood_donor && <Droplet size={16} className="shrink-0 fill-red-500 text-red-500" aria-label="Blood donor" />}</h1>
          <p className="truncate text-sm text-mute">@{profile.username}</p><div className="mt-1"><RankBadge tier={rk.name} size={14} /></div></div>
        <div className="flex shrink-0 items-center gap-2 pb-2">
          <button onClick={() => setAboutOpen(!aboutOpen)} className="flex items-center gap-1 rounded-full border border-line bg-surface px-3 py-1.5 text-sm">About<ChevronDown size={16} className={aboutOpen ? 'rotate-180' : ''} /></button>
          {socials.length > 0 && <div className="flex items-center gap-1 rounded-full border border-line bg-surface px-1 py-1">
            <button aria-label="Social links" onClick={() => setSocOpen(!socOpen)} className="p-1">{socOpen ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}</button>
            {!socOpen && (() => { const Ic = SOC_ICON[socials[0][0]] ?? Globe; return <Ic size={16} className="mr-1 text-accent" /> })()}
            {socOpen && socials.map(([k, v]) => { const Ic = SOC_ICON[k] ?? Globe; return <a key={k} href={safeUrl(v)} target="_blank" rel="noopener noreferrer" aria-label={k} className="p-1 text-accent"><Ic size={18} /></a> })}</div>}</div></div>
      <input ref={av} type="file" accept="image/*" hidden onChange={pick('avatar')} /><input ref={cv} type="file" accept="image/*" hidden onChange={pick('cover')} />
      {busy && <p className="text-sm text-mute">Uploading…</p>}{err && <p role="alert" className="text-sm text-red-400">{err}</p>}

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">{stat(c.friends, 'Friends', 'friends')}{stat(c.following, 'Following', 'following')}{stat(c.followers, 'Followers', 'followers')}<span><b className="text-ink">Lv {lvl}</b></span></div>
      {stats?.public_id && <button onClick={copyId} className="mt-2 inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs text-mute">ID <b className="tracking-wider text-ink">{stats.public_id}</b>{copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}{copied && 'Copied'}</button>}
      {profile.bio && <p className="mt-2">{profile.bio}</p>}
      {(profile.living_in || profile.location || profile.tagline) && <p className="mt-1 flex flex-wrap items-center gap-x-3 text-sm text-mute">{(profile.living_in || profile.location) && <span className="flex items-center gap-1"><MapPin size={14} />{profile.living_in || profile.location}</span>}{profile.tagline && <span className="italic">{profile.tagline}</span>}</p>}
      {aboutOpen && <div className="mt-3 flex flex-col gap-2 rounded-2xl border border-line bg-surface p-3"><b>About</b>
        {rows.length ? <ul className="flex flex-col gap-2">{rows.map(([I, k, v, href]) => <li key={k} className="flex items-center gap-3"><I size={18} className="shrink-0 text-accent" /><span className="text-mute">{k}:</span>{href ? <a href={href} target="_blank" rel="noreferrer" className="min-w-0 break-words underline decoration-accent">{v}</a> : <span className="min-w-0 break-words">{v}</span>}</li>)}</ul> : <p className="text-mute">No details added yet.</p>}</div>}

      <div className="my-3">{own
        ? <div className="flex gap-2"><Link to="/textora/edit-profile" className="flex-1 rounded-xl bg-accent px-4 py-2.5 text-center font-semibold text-on">Edit profile</Link><Link to="/textora/find" className="flex-1 rounded-xl border border-line px-4 py-2.5 text-center font-semibold">Find people</Link></div>
        : <div className="flex flex-col gap-2"><RelationButtons target={profile.id} onChange={loadCounts} /><MessageButton target={profile.id} /></div>}</div>

      <div className="flex flex-col gap-3">
        <div className="rounded-2xl border border-line bg-surface p-4">
          <div className="flex items-baseline justify-between"><b className="text-lg">Level {lvl}</b><span className="text-sm text-mute">{lvl >= MAX_LEVEL ? 'MAX' : `${xpIn} / ${need} XP`}</span></div>
          <div className="mt-2 h-3 overflow-hidden rounded-full bg-bg"><div className="h-full rounded-full transition-all duration-700" style={{ width: `${lvlPct}%`, background: 'linear-gradient(90deg, var(--accent), var(--accent2))' }} /></div>
          <p className="mt-2 text-xs text-mute">{own ? 'Chat with friends to earn XP. Every level needs more XP than the one before.' : `${name} is Level ${lvl}.`}</p></div>
        <div className="rounded-2xl border border-line bg-surface p-4">
          <div className="flex items-center justify-between"><span className="flex items-center gap-2 font-bold"><Trophy size={18} style={{ color: rk.color }} />{seasonName()} rank</span><RankBadge tier={rk.name} /></div>
          <div className="mt-2 h-3 overflow-hidden rounded-full bg-bg"><div className="h-full rounded-full transition-all duration-700" style={{ width: `${rk.pct}%`, background: rk.color }} /></div>
          <p className="mt-2 text-xs text-mute">{pts.toLocaleString()} points{rk.next ? ` · ${(rk.next[1] - pts).toLocaleString()} to ${rk.next[0]}` : ' · Top rank reached'} · season ends in {daysLeftInSeason()} days</p>
          <Link to="/textora/ranking" className="mt-3 flex items-center justify-center gap-2 rounded-xl border border-line py-2 text-sm font-semibold"><Trophy size={16} />Leaderboard</Link>
          <p className="mt-2 text-center text-xs text-mute">Grandmaster players receive special rewards every season.</p></div></div>
    </div></div>)
}
