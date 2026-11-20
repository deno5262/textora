import { Capacitor } from '@capacitor/core'
import { App } from '@capacitor/app'
import { PushNotifications } from '@capacitor/push-notifications'
export const isNative = Capacitor.isNativePlatform()
const openChat = (url: string) => { const m = /chat\/([\w-]+)/.exec(url); if (m) location.hash = `#/textora/c/${m[1]}` }
export function initNative() {
  if (!isNative) return
  // Notification / bubble taps arrive as textora://chat/<id>
  App.addListener('appUrlOpen', ({ url }) => openChat(url))
  App.getLaunchUrl().then(r => { if (r?.url) openChat(r.url) }).catch(() => {})
  // Android hardware back button: close sheets / go back; at the chat list, send app to background (like WhatsApp).
  App.addListener('backButton', () => {
    const sheetOpen = ((history.state as any)?.__d ?? 0) > 0   // a sheet/overlay pushed a history entry
    const atRoot = location.hash === '' || location.hash === '#/' || location.hash === '#/textora'
    if (sheetOpen || !atRoot) history.back(); else App.minimizeApp()
  })
  // Clear tray notifications once the user returns to the app.
  App.addListener('appStateChange', ({ isActive }) => { if (isActive) PushNotifications.removeAllDeliveredNotifications().catch(() => {}) })
}
