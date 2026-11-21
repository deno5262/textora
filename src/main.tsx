import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import './index.css'
import { AuthProvider } from './AuthContext'
import Guard from './Guard'
import Shell from './Shell'
import Auth from './Auth'
import Textora from './Textora'
import Chat from './Chat'
import CallsPage from './CallsPage'
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
    </Route></Route>
    <Route path="*" element={<Navigate to="/textora" replace />} />
  </Routes></PresenceProvider></AuthProvider></ErrorBoundary></HashRouter></React.StrictMode>)

setTimeout(() => { const s = document.getElementById('splash'); s?.classList.add('hide'); setTimeout(() => s?.remove(), 450) }, 350)
