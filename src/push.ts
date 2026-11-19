import { useEffect, useState } from 'react'
import { PushNotifications } from '@capacitor/push-notifications'
import { supabase } from './supabase'
import { useAuth } from './AuthContext'
import { isNative } from './native'

// Turned on automatically by the build when the GOOGLE_SERVICES_JSON secret exists (Firebase set up).
const PUSH_READY = import.meta.env.VITE_PUSH_READY === 'on'
const TOKEN_KEY = 'fcmToken', TRY_KEY = 'pushTry'
let wired = false
let currentUid: string | null = null

export type PushStatus = { flag: boolean; native: boolean; perm: string; token: string; saved: string; error: string }
const status: PushStatus = { flag: PUSH_READY, native: isNative, perm: '-', token: '-', saved: '-', error: '' }
const listeners = new Set<() => void>()
const set = (p: Partial<PushStatus>) => { Object.assign(status, p); listeners.forEach(f => f()) }
export function usePushStatus(): PushStatus {
  const [, f] = useState(0)
  useEffect(() => { const l = () => f(x => x + 1); listeners.add(l); return () => { listeners.delete(l) } }, [])
  return status
}

async function saveToken(uid: string, token: string): Promise<string> {
  localStorage.setItem(TOKEN_KEY, token)
  const r = await supabase.rpc('register_device_token', { p_token: token, p_platform: 'android' })
  if (!r.error) return 'saved ✔'
  const u = await supabase.from('device_tokens').upsert({ user_id: uid, token, platform: 'android', updated_at: new Date().toISOString() }, { onConflict: 'token' })
  return u.error ? 'DB error: ' + u.error.message : 'saved ✔'
}

async function wire() {
  if (wired) return
  wired = true
  await PushNotifications.createChannel({ id: 'messages', name: 'Messages', description: 'New message alerts', importance: 5, visibility: 1, vibration: true, lights: true })
  PushNotifications.addListener('registration', async t => {
    localStorage.removeItem(TRY_KEY)
    set({ token: t.value.slice(0, 14) + '…', saved: 'saving…' })
    set({ saved: currentUid ? await saveToken(currentUid, t.value) : 'no user' })
  })
  PushNotifications.addListener('registrationError', e => { localStorage.removeItem(TRY_KEY); set({ error: 'Registration error: ' + ((e as any).error ?? JSON.stringify(e)) }) })
  PushNotifications.addListener('pushNotificationActionPerformed', a => {
    const id = a.notification.data?.conversation_id; if (id) location.hash = `#/textora/c/${id}`
  })
}

/** Registers this device for FCM push. `force` skips the crash guard (manual retry). */
export async function setupPush(uid: string, force = false) {
  currentUid = uid
  set({ flag: PUSH_READY, native: isNative, error: '', saved: '-' })
  if (!isNative) return set({ error: 'Not running inside the Android app.' })
  if (!PUSH_READY) return set({ error: 'Push is OFF in this build. Add the GOOGLE_SERVICES_JSON secret on GitHub and run the build again.' })
  if (!force && localStorage.getItem(TRY_KEY)) { localStorage.removeItem(TRY_KEY); return set({ error: 'The last registration attempt closed the app, so push was paused. Tap Retry to try again.' }) }
  try {
    await wire()
    let perm = await PushNotifications.checkPermissions()
    if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') perm = await PushNotifications.requestPermissions()
    set({ perm: perm.receive })
    if (perm.receive !== 'granted') return set({ error: 'Notifications are blocked. Phone Settings → Apps → Textora → Notifications → Allow.' })
    localStorage.setItem(TRY_KEY, String(Date.now()))
    await PushNotifications.register()
  } catch (e) { localStorage.removeItem(TRY_KEY); set({ error: String((e as Error).message ?? e) }) }
}

export function usePush() {
  const { session } = useAuth(); const uid = session?.user.id
  useEffect(() => { if (uid) setupPush(uid) }, [uid])
}

/** Call before sign-out so this device stops receiving the previous user's messages. */
export async function dropPushToken() {
  const token = localStorage.getItem(TOKEN_KEY); if (!token) return
  await supabase.from('device_tokens').delete().eq('token', token); localStorage.removeItem(TOKEN_KEY)
}
