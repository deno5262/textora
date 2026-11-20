import type { CapacitorConfig } from '@capacitor/cli'
const config: CapacitorConfig = {
  appId: 'com.nexora.textora',   // change before publishing; must match the Firebase Android app
  appName: 'TextGen',
  webDir: 'dist',
  android: { allowMixedContent: false },
  plugins: { PushNotifications: { presentationOptions: ['badge', 'sound', 'alert'] } }
}
export default config
