import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import styles from './LoginPage.module.css'

interface Props {
  onLogin: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>
  onRegister: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>
  onForgotPassword: (email: string) => Promise<{ ok: boolean; error?: string }>
  onGuestLogin: () => Promise<{ ok: boolean; error?: string }>
  /** Aviso informativo al llegar al login (p. ej. sesión vencida). */
  notice?: string
}

export default function LoginPage({ onLogin, onRegister, onForgotPassword, onGuestLogin, notice }: Props) {
  const [modo, setModo] = useState<'login' | 'registro' | 'recuperar'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [guestLoading, setGuestLoading] = useState(false)

  const handleGuest = async () => {
    setError('')
    setGuestLoading(true)
    const result = await onGuestLogin()
    if (!result.ok) {
      setError(result.error || 'Error al ingresar como invitado')
      setGuestLoading(false)
    }
  }

  const esRegistro = modo === 'registro'
  const esRecuperar = modo === 'recuperar'

  const cambiarModo = (nuevoModo: 'login' | 'registro' | 'recuperar') => {
    setModo(nuevoModo)
    setError('')
    setSuccess('')
    setPassword('')
    setConfirm('')
    setShowPass(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (esRegistro) {
      if (password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres'); return }
      if (password !== confirm) { setError('Las contraseñas no coinciden'); return }
    }

    setLoading(true)

    if (esRecuperar) {
      const result = await onForgotPassword(email)
      setLoading(false)
      if (!result.ok) {
        setError(result.error || 'Error al enviar el email')
      } else {
        setSuccess('Si el email está registrado, te enviamos un enlace para restablecer tu contraseña. Revisá tu casilla.')
      }
      return
    }

    const result = await (esRegistro ? onRegister(email, password) : onLogin(email, password))
    if (!result.ok) {
      setError(result.error || 'Error al ingresar')
      setLoading(false)
    }
  }

  const titulo = esRegistro ? 'Crear cuenta'
    : esRecuperar ? 'Recuperar acceso'
    : 'Bienvenida'

  const subtitulo = esRegistro ? 'Registrate para empezar tu biblioteca'
    : esRecuperar ? 'Ingresá tu email y te enviamos un enlace'
    : 'Iniciá sesión para ver tu biblioteca'

  return (
    <div className={styles.page}>
      {/* Left decorative panel — desktop only */}
      <div className={styles.left} aria-hidden="true">
        <div className={styles.decoration}>
          <div className={styles.bookStack}>
            <div className={styles.book} style={{ '--c': '#2d4a3e', '--r': '-8deg', '--t': '0px' } as React.CSSProperties} />
            <div className={styles.book} style={{ '--c': '#c9a84c', '--r': '3deg', '--t': '-12px' } as React.CSSProperties} />
            <div className={styles.book} style={{ '--c': '#1a3a5c', '--r': '-2deg', '--t': '-24px' } as React.CSSProperties} />
            <div className={styles.book} style={{ '--c': '#4a2040', '--r': '6deg', '--t': '-36px' } as React.CSSProperties} />
          </div>
        </div>
        <div className={styles.leftContent}>
          <p className={styles.brand}>Librook</p>
          <p className={styles.tagline}>Tu biblioteca personal.</p>
        </div>
      </div>

      {/* Right form panel */}
      <main className={styles.right}>
        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <div className={styles.formHeader}>
            {/* Brand shown only on mobile (hidden on desktop since it's in .left) */}
            <span className={styles.brandMobile}>Librook</span>
            <h1 className={styles.welcome}>{titulo}</h1>
            <p className={styles.subtitle}>{subtitulo}</p>
          </div>

          <div className={styles.fields}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="email">Email</label>
              <input
                id="email"
                className={styles.input}
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="vos@ejemplo.com"
                required
                autoFocus
                autoComplete="email"
                inputMode="email"
              />
            </div>

            {!esRecuperar && (
              <div className={styles.field}>
                <label className={styles.label} htmlFor="password">Contraseña</label>
                <div className={styles.passwordWrap}>
                  <input
                    id="password"
                    className={styles.input}
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    autoComplete={esRegistro ? 'new-password' : 'current-password'}
                  />
                  <button
                    type="button"
                    className={styles.showPassBtn}
                    onClick={() => setShowPass(v => !v)}
                    aria-label={showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    {showPass ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                        <line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8"/>
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            )}

            {esRegistro && (
              <div className={styles.field}>
                <label className={styles.label} htmlFor="confirm">Repetir contraseña</label>
                <input
                  id="confirm"
                  className={styles.input}
                  type={showPass ? 'text' : 'password'}
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="new-password"
                />
              </div>
            )}

            {notice && !error && !success && <p className={styles.successMsg} role="status">{notice}</p>}
            {error && <p className={styles.error} role="alert">{error}</p>}
            {success && <p className={styles.successMsg} role="status">{success}</p>}

            {!success && (
              <button className={styles.btn} type="submit" disabled={loading}>
                {loading ? <span className={styles.spinner} aria-hidden="true" />
                  : esRegistro ? 'Crear cuenta'
                  : esRecuperar ? 'Enviar enlace'
                  : 'Ingresar'}
              </button>
            )}

            {success && esRecuperar && (
              <button type="button" className={styles.btn} onClick={() => cambiarModo('login')}>
                Ir al inicio de sesión
              </button>
            )}

            {!esRegistro && !esRecuperar && !success && (
              <button
                type="button"
                className={styles.btnGhost}
                onClick={handleGuest}
                disabled={loading || guestLoading}
              >
                {guestLoading ? <span className={styles.spinner} aria-hidden="true" /> : 'Ver sin cuenta'}
              </button>
            )}
          </div>

          {!esRegistro && !esRecuperar && (
            <p className={styles.toggle}>
              <Link to="/catalog" className={styles.toggleBtn}>Explorar el catálogo público</Link>
            </p>
          )}

          <div className={styles.links}>
            {!esRegistro && !esRecuperar && (
              <button type="button" className={styles.toggleBtn} onClick={() => cambiarModo('recuperar')}>
                Olvidé mi contraseña
              </button>
            )}
            {esRecuperar && (
              <button type="button" className={styles.toggleBtn} onClick={() => cambiarModo('login')}>
                Volver al inicio de sesión
              </button>
            )}
            <p className={styles.toggle}>
              {esRegistro ? (
                <>¿Ya tenés cuenta?{' '}
                  <button type="button" className={styles.toggleBtn} onClick={() => cambiarModo('login')}>
                    Iniciá sesión
                  </button>
                </>
              ) : !esRecuperar ? (
                <>¿No tenés cuenta?{' '}
                  <button type="button" className={styles.toggleBtn} onClick={() => cambiarModo('registro')}>
                    Registrate
                  </button>
                </>
              ) : null}
            </p>
          </div>
        </form>
      </main>
    </div>
  )
}
