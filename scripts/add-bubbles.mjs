// Adds native chat-bubble notification support to the generated Android project.
import fs from 'fs'
import path from 'path'
const cfg = fs.readFileSync('capacitor.config.ts', 'utf8')
const pkg = /appId:\s*'([^']+)'/.exec(cfg)[1]
const javaDir = path.join('android/app/src/main/java', ...pkg.split('.'))
fs.mkdirSync(javaDir, { recursive: true })
for (const f of ['AppState.java', 'MainActivity.java', 'BubbleActivity.java', 'TextoraMessagingService.java'])
  fs.writeFileSync(path.join(javaDir, f), fs.readFileSync(path.join('native', f), 'utf8').replaceAll('__PKG__', pkg))
const resDir = 'android/app/src/main/res/drawable'
fs.mkdirSync(resDir, { recursive: true })
fs.copyFileSync('native/ic_stat_textora.xml', path.join(resDir, 'ic_stat_textora.xml'))

// manifest: bubble activity + our FCM service (higher priority than the plugin's)
const mp = 'android/app/src/main/AndroidManifest.xml'
let m = fs.readFileSync(mp, 'utf8')
if (!m.includes('BubbleActivity')) {
  const add = `
        <activity android:name=".BubbleActivity" android:allowEmbedded="true" android:resizeableActivity="true" android:documentLaunchMode="always" android:exported="true"
            android:configChanges="orientation|keyboardHidden|keyboard|screenSize|locale|smallestScreenSize|screenLayout|uiMode|navigation|density"
            android:theme="@style/AppTheme.NoActionBarLaunch" />
        <service android:name=".TextoraMessagingService" android:exported="false">
            <intent-filter android:priority="100">
                <action android:name="com.google.firebase.MESSAGING_EVENT" />
            </intent-filter>
        </service>
`
  m = m.replace('</application>', add + '    </application>')
  fs.writeFileSync(mp, m)
}
// gradle: firebase-messaging is needed at compile time for our service
const gp = 'android/app/build.gradle'
let g = fs.readFileSync(gp, 'utf8')
if (!g.includes('firebase-messaging')) {
  g = g.replace(/dependencies\s*\{/, "dependencies {\n    implementation 'com.google.firebase:firebase-messaging:23.3.1'")
  fs.writeFileSync(gp, g)
}
console.log('Native bubbles added ✔ (' + pkg + ')')
