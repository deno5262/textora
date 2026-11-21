import { Capacitor } from '@capacitor/core'
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera'

const toFile = async (webPath: string, format: string, name: string): Promise<File> => {
  const blob = await (await fetch(webPath)).blob(); const f = (format || 'jpeg').toLowerCase(); const ext = f === 'jpg' ? 'jpeg' : f
  return new File([blob], `${name}.${f === 'jpeg' ? 'jpg' : f}`, { type: blob.type || `image/${ext}` })
}
/** Opens the phone's photo gallery (multiple photos). Returns null when not running as the Android app. */
export async function pickGallery(): Promise<File[] | null> {
  if (!Capacitor.isNativePlatform()) return null
  try { const r = await Camera.pickImages({ quality: 90, limit: 10 }); return await Promise.all(r.photos.map((p, i) => toFile(p.webPath, p.format, `photo-${Date.now()}-${i}`))) } catch { return [] }
}
/** Opens the camera for one photo. */
export async function takePhoto(): Promise<File[] | null> {
  if (!Capacitor.isNativePlatform()) return null
  try { const p = await Camera.getPhoto({ source: CameraSource.Camera, resultType: CameraResultType.Uri, quality: 90 }); return [await toFile(p.webPath!, p.format, `camera-${Date.now()}`)] } catch { return [] }
}
