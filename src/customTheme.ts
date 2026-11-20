// User-made colour theme (stored on the phone, applied on top of the chosen app theme).
export type Custom = { bg: string; surface: string; accent: string }
const KEY = 'customTheme'
const lum = (hex: string) => { const n = parseInt(hex.slice(1), 16); const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255; return (0.299 * r + 0.587 * g + 0.114 * b) / 255 }
export const loadCustom = (): Custom | null => { try { return JSON.parse(localStorage.getItem(KEY) ?? 'null') } catch { return null } }
export function applyCustom(c: Custom | null = loadCustom()) {
  const s = document.documentElement.style
  const vars = ['--bg', '--surface', '--accent', '--accent2', '--ink', '--mute', '--line', '--on']
  if (!c) { vars.forEach(v => s.removeProperty(v)); return }
  const dark = lum(c.bg) < 0.5
  s.setProperty('--bg', c.bg); s.setProperty('--surface', c.surface); s.setProperty('--accent', c.accent); s.setProperty('--accent2', c.accent)
  s.setProperty('--ink', dark ? '#f5f6fa' : '#14161f'); s.setProperty('--mute', dark ? '#9aa0b4' : '#5c6275')
  s.setProperty('--line', dark ? 'rgba(255,255,255,.12)' : 'rgba(0,0,0,.12)'); s.setProperty('--on', lum(c.accent) < 0.55 ? '#ffffff' : '#111111')
}
export function saveCustom(c: Custom) { localStorage.setItem(KEY, JSON.stringify(c)); applyCustom(c) }
export function clearCustom() { localStorage.removeItem(KEY); applyCustom(null) }
