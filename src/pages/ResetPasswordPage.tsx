import React, { useEffect, useRef, useState } from 'react'
import styles from './LoginPage.module.css'

interface Props {
  token: string
  onReset: (token: string, password: string) => Promise<{ ok: boolean; error?: string }>
  onDone: () => void
}

export default function ResetPasswordPage({ token, onReset, onDone }: Props) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const successRef = useRef<HTMLParagraphElement>(null)

  // El formulario (y el botón que tenía el foco) desaparece al terminar: el foco
  // pasa al mensaje para que el lector de pantalla lo anuncie.
  useEffect(() => {
    if (success) successRef.current?.focus()
  }, [success])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres'); return }
    if (password !== confirm) { setError('Las contraseñas no coinciden'); return }
    setLoading(true)
    const result = await onReset(token, password)
    setLoading(false)
    if (!result.ok) { setError(result.error || 'Error al restablecer'); return }
    setSuccess(true)
  }

  return (
    <div className={styles.page}>
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

      <main className={styles.right}>
        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <div className={styles.formHeader}>
            <h1 className={styles.welcome}>Nueva contraseña</h1>
            <p className={styles.subtitle}>Elegí una nueva contraseña para tu cuenta</p>
          </div>

          {!success ? (
            <div className={styles.fields}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="password">Contraseña nueva</label>
                <input
                  id="password"
                  className={styles.input}
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="new-password"
                  autoFocus
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="confirm">Repetir contraseña</label>
                <input
                  id="confirm"
                  className={styles.input}
                  type="password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="new-password"
                />
              </div>
              {error && <p className={styles.error} role="alert">{error}</p>}
              <button className={styles.btn} type="submit" disabled={loading}>
                {loading ? <span className={styles.spinner} /> : 'Cambiar contraseña'}
              </button>
            </div>
          ) : (
            <div className={styles.fields}>
              <p className={styles.successMsg} role="status" tabIndex={-1} ref={successRef}>
                ¡Contraseña actualizada! Ya podés iniciar sesión.
              </p>
              <button type="button" className={styles.btn} onClick={onDone}>
                Ir al inicio de sesión
              </button>
            </div>
          )}
        </form>
      </main>
    </div>
  )
}
