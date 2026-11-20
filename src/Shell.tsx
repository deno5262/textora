import { Outlet } from 'react-router-dom'
import { useEffect, useState } from 'react'
import PullRefresh from './PullRefresh'
import MessageAlerts from './MessageAlerts'
import { usePush } from './push'
import ErrorBar from './ErrorBar'
import { CallProvider } from './calls'
import { useTypingListener } from './typingBus'
import { useAuth } from './AuthContext'
export default function Shell() {
  const [offline, setOffline] = useState(!navigator.onLine)
  usePush(); const { session } = useAuth(); useTypingListener(session?.user.id)
  useEffect(() => {
    const on = () => setOffline(false), off = () => setOffline(true)
    window.addEventListener('online', on); window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])
  return (<CallProvider><div className="mx-auto max-w-xl">
    <MessageAlerts /><PullRefresh /><ErrorBar />
    {offline && <div className="fixed inset-x-0 top-0 z-[60] bg-red-600 py-1 text-center text-sm text-white">You're offline.</div>}
    <Outlet />
  </div></CallProvider>)
}
