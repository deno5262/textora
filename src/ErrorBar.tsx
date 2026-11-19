import { useEffect, useState } from 'react'
// Shows unexpected runtime errors on screen so they can be screenshotted and fixed.
export default function ErrorBar() {
  const [msg, setMsg] = useState('')
  useEffect(() => {
    const on = (e: ErrorEvent) => setMsg(e.message || 'Unknown error')
    const rej = (e: PromiseRejectionEvent) => setMsg(String((e.reason && (e.reason.message || e.reason)) || 'Request failed'))
    window.addEventListener('error', on); window.addEventListener('unhandledrejection', rej)
    return () => { window.removeEventListener('error', on); window.removeEventListener('unhandledrejection', rej) }
  }, [])
  if (!msg) return null
  return <div onClick={() => setMsg('')} className="fixed inset-x-2 bottom-20 z-[90] rounded-xl bg-red-700 p-3 text-xs text-white shadow-xl">⚠ {msg.slice(0, 220)} <span className="opacity-70">(tap to dismiss)</span></div>
}
