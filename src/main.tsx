import React, { lazy, Suspense } from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter, Link, Navigate, Route, Routes } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import './index.css'
import { AuthProvider } from './AuthContext'
import Guard from './Guard'
import Shell from './Shell'
import Auth from './Auth'
import Textora from './Textora'
import Chat from './Chat'
import CallsPage from './CallsPage'
import Profile from './Profile'
import EditProfile from './EditProfile'
import FollowList from './FollowList'
import FindPeople from './FindPeople'
import Ranking from './Ranking'
import LiveHome from './LiveHome'
const LiveRoom = lazy(() => import('./LiveRoom'))
import ErrorBoundary from './ErrorBoundary'
import { PresenceProvider } from './Presence'
import { initNative } from './native'

import { applyCustom } from './customTheme'
applyCustom()
initNative()

// HashRouter: works reliably inside the Android WebView (no server-side routing needed).
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><HashRouter><ErrorBoundary><AuthProvider><PresenceProvider><Routes>
    <Route path="/login" element={<Auth mode="login" />} /><Route path="/signup" element={<Auth mode="signup" />} /><Route path="/reset" element={<Auth mode="reset" />} />
    <Route element={<Guard />}><Route element={<Shell />}>
      <Route index element={<Navigate to="/textora" replace />} />
      <Route path="textora" element={<Textora tab="chats" />} />
      <Route path="textora/people" element={<Textora tab="people" />} />
      <Route path="textora/menu" element={<Textora tab="menu" />} />
      <Route path="textora/settings" element={<Textora tab="settings" />} />
      <Route path="textora/me" element={<Textora tab="menu" />} />
      <Route path="textora/c/:id" element={<Chat />} />
      <Route path="textora/calls" element={<CallsPage />} />
      <Route path="textora/profile" element={<Profile />} />
      <Route path="textora/u/:username" element={<Profile />} />
      <Route path="textora/u/:username/list/:kind" element={<FollowList />} />
      <Route path="textora/edit-profile" element={<div className="flex flex-col gap-3 p-4"><Link to="/textora/profile" className="flex items-center gap-1 text-accent"><ArrowLeft size={18} />Back to profile</Link><EditProfile /></div>} />
      <Route path="textora/find" element={<FindPeople />} />
      <Route path="textora/ranking" element={<Ranking />} />
      <Route path="textora/live" element={<LiveHome />} />
      <Route path="textora/live/:id" element={<Suspense fallback={<div className="fixed inset-0 z-40 grid place-items-center bg-bg text-mute">Loading…</div>}><LiveRoom /></Suspense>} />
    </Route></Route>
    <Route path="*" element={<Navigate to="/textora" replace />} />
  </Routes></PresenceProvider></AuthProvider></ErrorBoundary></HashRouter></React.StrictMode>)

requestAnimationFrame(() => requestAnimationFrame(() => { const s = document.getElementById('splash'); s?.classList.add('hide'); setTimeout(() => s?.remove(), 250) }))
