import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react'
import type { Session } from '@supabase/supabase-js'
import { cacheGet, cacheSet } from './cache'
import { supabase, Profile } from './supabase'
type Ctx = { session: Session | null; profile: Profile | null; theme: string; loading: boolean; setTheme: (t: string) => Promise<void>; preview: (t: string) => void; refresh: () => Promise<void> }
const C = createContext<Ctx>(null as unknown as Ctx)
export const useAuth = () => useContext(C)
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(() => cacheGet<Profile>('profile'))
  const [theme, setThemeState] = useState(localStorage.getItem('theme') || 'neon_cyan')
  const [loading, setLoading] = useState(true)
  const apply = (t: string) => { document.documentElement.dataset.theme = t; localStorage.setItem('theme', t); setThemeState(t) }
  const load = useCallback(async (s: Session | null) => {
    if (!s) { setProfile(null); try { localStorage.removeItem('nx:profile') } catch { /* ignore */ } return }
    const [p, st] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', s.user.id).single(),
      supabase.from('user_settings').select('theme').eq('user_id', s.user.id).single()])
    if (p.data) { setProfile(p.data as Profile); cacheSet('profile', p.data) }
    if (st.data?.theme && !localStorage.getItem('themeChosen')) apply(st.data.theme)
  }, [])
  useEffect(() => {
    apply(theme)
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); const c = cacheGet<Profile>('profile'); if (data.session && c && c.id === data.session.user.id) { setLoading(false); load(data.session) } else load(data.session).finally(() => setLoading(false)) }).catch(() => setLoading(false))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => { setSession(s); load(s) })
    return () => sub.subscription.unsubscribe()
  }, [])
  const setTheme = async (t: string) => {
    apply(t); localStorage.setItem('themeChosen', '1')
    if (session) await supabase.from('user_settings').upsert({ user_id: session.user.id, theme: t, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
  }
  return <C.Provider value={{ session, profile, theme, loading, setTheme, preview: apply, refresh: () => load(session) }}>{children}</C.Provider>
}
