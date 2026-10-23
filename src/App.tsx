import { useState, useEffect, useRef } from 'react'
import { Routes, Route } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { useTheme } from './hooks/useTheme'
import LoginPage from './pages/LoginPage'
import LibraryMain from './LibraryMain'
import ResetPasswordPage from './pages/ResetPasswordPage'
import AdminPage from './pages/AdminPage'
import CatalogPage from './pages/CatalogPage'
import WorkPage from './pages/WorkPage'

const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL

function getSessionId() {
  let sid = sessionStorage.getItem('lbr_sid')
  if (!sid) {
    sid = Math.random().toString(36).slice(2) + Date.now().toString(36)
    sessionStorage.setItem('lbr_sid', sid)
  }
  return sid
}

function trackView(path: string) {
  // El servidor toma el email del token (no se manda en el body: no confía en él)
  const token = localStorage.getItem('librook_token')
  fetch('/librook-api/analytics/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({
      session_id: getSessionId(),
      path,
      referrer: document.referrer,
      user_agent: navigator.userAgent,
    }),
    keepalive: true,
  }).catch(() => {})
}

export default function App() {
  return (
    <Routes>
      <Route path="/catalog" element={<CatalogPage />} />
      <Route path="/catalog/obra/:id" element={<WorkPage />} />
      <Route path="*" element={<AuthenticatedApp />} />
    </Routes>
  )
}

function AuthenticatedApp() {
  const { user, sessionExpired, login, register, forgotPassword, resetPassword, guestLogin, logout } = useAuth()
  const { dark, toggle: toggleTheme } = useTheme()
  const [adminOpen, setAdminOpen] = useState(false)

  const [resetToken] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search)
    return params.get('reset_token')
  })

  // Analytics tracking
  const section = !user ? 'login' : adminOpen ? 'admin' : 'biblioteca'
  const lastSection = useRef('')
  useEffect(() => {
    if (section === lastSection.current) return
    lastSection.current = section
    trackView(section)
  }, [section, user?.email])

  const handleResetDone = () => {
    window.history.replaceState({}, '', window.location.pathname)
    window.location.reload()
  }

  if (resetToken) {
    return <ResetPasswordPage token={resetToken} onReset={resetPassword} onDone={handleResetDone} />
  }

  if (!user) {
    return (
      <LoginPage
        onLogin={login}
        onRegister={register}
        onForgotPassword={forgotPassword}
        onGuestLogin={guestLogin}
        notice={sessionExpired ? 'Tu sesión expiró. Ingresá de nuevo para seguir.' : undefined}
      />
    )
  }

  if (adminOpen && user.email === ADMIN_EMAIL) {
    return <AdminPage onBack={() => setAdminOpen(false)} />
  }

  return (
    <LibraryMain
      user={user}
      onLogout={logout}
      dark={dark}
      onToggleTheme={toggleTheme}
      onOpenAdmin={user.email === ADMIN_EMAIL ? () => setAdminOpen(true) : undefined}
    />
  )
}
