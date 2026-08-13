import { useState } from 'react'
import { api } from '../api'

const TOKEN_KEY = 'librook_token'
const AUTH_KEY = 'librook_auth'

export function useAuth() {
  const [user, setUser] = useState<{ email: string } | null>(() => {
    try {
      const stored = localStorage.getItem(AUTH_KEY)
      return stored ? JSON.parse(stored) : null
    } catch { return null }
  })

  const saveSession = (data: { token: string; email: string }) => {
    localStorage.setItem(TOKEN_KEY, data.token)
    const userData = { email: data.email }
    localStorage.setItem(AUTH_KEY, JSON.stringify(userData))
    setUser(userData)
  }

  const register = async (email: string, password: string) => {
    try {
      saveSession(await api.post('/auth/register', { email, password }))
      return { ok: true }
    } catch (err: unknown) {
      return { ok: false, error: (err as Error).message }
    }
  }

  const login = async (email: string, password: string) => {
    try {
      saveSession(await api.post('/auth/login', { email, password }))
      return { ok: true }
    } catch (err: unknown) {
      return { ok: false, error: (err as Error).message }
    }
  }

  const guestLogin = async () => {
    try {
      saveSession(await api.post('/auth/demo-login', {}))
      return { ok: true }
    } catch (err: unknown) {
      return { ok: false, error: (err as Error).message }
    }
  }

  const forgotPassword = async (email: string) => {
    try {
      await api.post('/auth/forgot-password', { email })
      return { ok: true }
    } catch (err: unknown) {
      return { ok: false, error: (err as Error).message }
    }
  }

  const resetPassword = async (token: string, password: string) => {
    try {
      await api.post('/auth/reset-password', { token, password })
      return { ok: true }
    } catch (err: unknown) {
      return { ok: false, error: (err as Error).message }
    }
  }

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(AUTH_KEY)
    setUser(null)
  }

  return { user, login, register, forgotPassword, resetPassword, guestLogin, logout }
}
