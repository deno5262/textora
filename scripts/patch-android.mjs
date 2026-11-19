// Run automatically by `npm run android:add`. Adds the permissions Textora needs to AndroidManifest.xml.
import fs from 'fs'
const p = 'android/app/src/main/AndroidManifest.xml'
let x = fs.readFileSync(p, 'utf8')
const perms = ['android.permission.POST_NOTIFICATIONS', 'android.permission.RECORD_AUDIO', 'android.permission.MODIFY_AUDIO_SETTINGS', 'android.permission.CAMERA', 'android.permission.VIBRATE']
for (const perm of perms) if (!x.includes(perm)) x = x.replace('</manifest>', `    <uses-permission android:name="${perm}" />\n</manifest>`)
fs.writeFileSync(p, x); console.log('AndroidManifest patched ✔')
