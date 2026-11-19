import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { PushNotifications } from '@capacitor/push-notifications'
import { supabase } from './supabase'
import { useAuth } from './AuthContext'
import { isNative } from './native'
const TOKEN_KEY = 'fcmToken'
let wired = false
async function saveToken(uid: string, token: string) {
  localStorage.setItem(TOKEN_KEY, token)
  await supabase.from('device_tokens').upsert({ user_id: uid, token, platform: 'android', updated_at: new Date().toISOString() }, { onConflict: 'token' })
}
/** Registers this device for FCM push and routes notification taps to the right chat. */
export function usePush() {
  const { session } = useAuth(); const uid = session?.user.id; const nav = useNavigate()
  useEffect(() => {
    if (!isNative || !uid || true) return
    let cancelled = false
    ;(async () => {
      if (!wired) {
        wired = true
        await PushNotifications.createChannel({ id: 'messages', name: 'Messages', description: 'New message alerts', importance: 5, visibility: 1, vibration: true, lights: true })
        PushNotifications.addListener('registrationError', e => console.warn('push registration error', e))
        PushNotifications.addListener('pushNotificationActionPerformed', a => {
          const id = a.notification.data?.conversation_id; if (id) nav(`/textora/c/${id}`)
        })
      }
      PushNotifications.addListener('registration', t => { if (!cancelled) saveToken(uid, t.value) })
      let perm = await PushNotifications.checkPermissions()
      if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') perm = await PushNotifications.requestPermissions()
      if (perm.receive === 'granted' && !cancelled) await PushNotifications.register()
    })().catch(e => console.warn('push setup failed', e))
    return () => { cancelled = true; PushNotifications.removeAllListeners().then(() => { wired = false }).catch(() => {}) }
  }, [uid])
}
/** Call before sign-out so this device stops receiving the previous user's messages. */
export async function dropPushToken() {
  const token = localStorage.getItem(TOKEN_KEY); if (!token) return
  await supabase.from('device_tokens').delete().eq('token', token); localStorage.removeItem(TOKEN_KEY)
}
