// Run automatically by `npm run android:add`. Adds the permissions Textora needs to AndroidManifest.xml.
import fs from 'fs'
const p = 'android/app/src/main/AndroidManifest.xml'
let x = fs.readFileSync(p, 'utf8')
const perms = ['android.permission.POST_NOTIFICATIONS', 'android.permission.RECORD_AUDIO', 'android.permission.MODIFY_AUDIO_SETTINGS', 'android.permission.CAMERA', 'android.permission.VIBRATE']
for (const perm of perms) if (!x.includes(perm)) x = x.replace('</manifest>', `    <uses-permission android:name="${perm}" />\n</manifest>`)
fs.mkdirSync('android/app/src/main/res/drawable', { recursive: true })
fs.copyFileSync('native/ic_stat_textora.xml', 'android/app/src/main/res/drawable/ic_stat_textora.xml')
if (!x.includes('default_notification_icon')) x = x.replace('</application>', '    <meta-data android:name="com.google.firebase.messaging.default_notification_icon" android:resource="@drawable/ic_stat_textora" />\n    </application>')

// launcher icon, splash screen and brand colour
const copyDir = (from, to) => { for (const e of fs.readdirSync(from, { withFileTypes: true })) { const a = from + '/' + e.name, b = to + '/' + e.name; if (e.isDirectory()) { fs.mkdirSync(b, { recursive: true }); copyDir(a, b) } else fs.copyFileSync(a, b) } }
copyDir('native/res', 'android/app/src/main/res')
fs.mkdirSync('android/app/src/main/res/values', { recursive: true })
fs.writeFileSync('android/app/src/main/res/values/ic_launcher_background.xml', '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#0E1127</color>\n</resources>\n')
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(d + '/' + e.name) : [d + '/' + e.name])
for (const f of walk('android/app/src/main/res')) if (f.endsWith('/splash.png')) fs.copyFileSync(f.includes('land') ? 'native/splash-land.png' : 'native/splash-port.png', f)
fs.writeFileSync(p, x); console.log('AndroidManifest patched ✔')
