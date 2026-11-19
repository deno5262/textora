import { Capacitor } from '@capacitor/core'
import { App } from '@capacitor/app'
import { PushNotifications } from '@capacitor/push-notifications'
export const isNative = Capacitor.isNativePlatform()
export function initNative() {
  if (!isNative) return
  // Android hardware back button: close sheets / go back; at the chat list, send app to background (like WhatsApp).
  App.addListener('backButton', () => {
    const atRoot = /^#?\/?(textora)?\/?$/.test(location.hash) || location.hash === '#/textora'
    if (atRoot) App.minimizeApp(); else history.back()
  })
  // Clear tray notifications once the user returns to the app.
  App.addListener('appStateChange', ({ isActive }) => { if (isActive) PushNotifications.removeAllDeliveredNotifications().catch(() => {}) })
}
