// Adds native chat notifications to the generated Android project.
//   node scripts/add-bubbles.mjs          -> full version (chat bubbles)
//   node scripts/add-bubbles.mjs basic    -> basic version (picture + delivery receipt, no bubbles)
import fs from 'fs'
import path from 'path'
const mode = process.argv[2] === 'basic' ? 'basic' : 'full'
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(d + '/' + e.name) : [d + '/' + e.name])
const mainPath = walk('android/app/src/main/java').find(f => f.endsWith('/MainActivity.java'))
if (!mainPath) throw new Error('MainActivity.java not found')
const javaDir = path.dirname(mainPath)
const pkg = /package\s+([\w.]+)\s*;/.exec(fs.readFileSync(mainPath, 'utf8'))[1]
const put = (name, from) => fs.writeFileSync(path.join(javaDir, name), fs.readFileSync(from, 'utf8').replaceAll('__PKG__', pkg))
put('AppState.java', 'native/AppState.java'); put('MainActivity.java', 'native/MainActivity.java')
put('TextoraMessagingService.java', mode === 'basic' ? 'native/basic/TextoraMessagingService.java' : 'native/TextoraMessagingService.java')
if (mode === 'full') put('BubbleActivity.java', 'native/BubbleActivity.java')
const resDir = 'android/app/src/main/res/drawable'
fs.mkdirSync(resDir, { recursive: true })
fs.copyFileSync('native/ic_stat_textora.xml', path.join(resDir, 'ic_stat_textora.xml'))

const mp = 'android/app/src/main/AndroidManifest.xml'
let m = fs.readFileSync(mp, 'utf8')
if (!m.includes('xmlns:tools')) m = m.replace('<manifest ', '<manifest xmlns:tools="http://schemas.android.com/tools" ')
if (!m.includes('TextoraMessagingService')) {
  const bubble = mode === 'full' ? `
        <activity android:name="${pkg}.BubbleActivity" android:allowEmbedded="true" android:resizeableActivity="true" android:documentLaunchMode="always" android:exported="true"
            android:configChanges="orientation|keyboardHidden|keyboard|screenSize|locale|smallestScreenSize|screenLayout|uiMode|navigation|density"
            android:theme="@style/AppTheme.NoActionBarLaunch" />` : ''
  const add = `${bubble}
        <service android:name="com.capacitorjs.plugins.pushnotifications.MessagingService" tools:node="remove" />
        <service android:name="${pkg}.TextoraMessagingService" android:exported="false">
            <intent-filter android:priority="100">
                <action android:name="com.google.firebase.MESSAGING_EVENT" />
            </intent-filter>
        </service>
`
  m = m.replace('</application>', add + '    </application>')
  fs.writeFileSync(mp, m)
}
const gp = 'android/app/build.gradle'
let g = fs.readFileSync(gp, 'utf8')
if (!g.includes('firebase-messaging')) {
  g = g.replace(/dependencies\s*\{/, "dependencies {\n    implementation 'com.google.firebase:firebase-messaging:23.3.1'")
  fs.writeFileSync(gp, g)
}
console.log(`Native notifications added (${mode}, package ${pkg})`)
