import { useEffect, useRef, useState } from 'react'
import { useDialogA11y } from '../hooks/useDialogA11y'
import styles from './ISBNScanner.module.css'

export default function ISBNScanner({ onScan, onClose }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const rafRef = useRef(null)
  const [estado, setEstado] = useState(() =>
    'BarcodeDetector' in window ? 'iniciando' : 'noSoportado'
  )

  const stop = () => {
    cancelAnimationFrame(rafRef.current)
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }

  useEffect(() => {
    if (!('BarcodeDetector' in window)) return

    const iniciar = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } },
        })
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }
        setEstado('escaneando')

        const detector = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'isbn', 'code_128'] })

        const loop = async () => {
          if (!videoRef.current || videoRef.current.readyState < 2) {
            rafRef.current = requestAnimationFrame(loop)
            return
          }
          try {
            const codes = await detector.detect(videoRef.current)
            if (codes.length > 0) {
              stop()
              onScan(codes[0].rawValue)
              return
            }
          } catch (_e) {
            // BarcodeDetector puede fallar en algunos fotogramas — se reintenta
          }
          rafRef.current = requestAnimationFrame(loop)
        }
        rafRef.current = requestAnimationFrame(loop)
      } catch {
        setEstado('error')
      }
    }

    iniciar()
    return () => stop()
  }, [onScan])

  const handleClose = () => { stop(); onClose() }
  // Se abre encima de BookModal (que suelta su propio trap mientras tanto):
  // foco adentro, Escape cierra solo el escáner y el foco vuelve al botón.
  const dialogRef = useDialogA11y(handleClose)

  return (
    <div className={styles.overlay}>
      <div
        ref={dialogRef}
        className={styles.container}
        role="dialog"
        aria-modal="true"
        aria-labelledby="isbn-scanner-title"
        tabIndex={-1}
      >
        <div className={styles.header}>
          <span className={styles.titulo} id="isbn-scanner-title">Escanear ISBN</span>
          <button className={styles.cerrarBtn} onClick={handleClose} aria-label="Cerrar">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <path d="M2 2l14 14M16 2L2 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div className={styles.cuerpo}>
          {estado === 'noSoportado' && (
            <div className={styles.mensaje} role="status">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" opacity="0.5" aria-hidden="true">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M12 8v5M12 16h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
              <p>Tu navegador no soporta el escaneo de códigos de barras.</p>
              <p>Ingresá el ISBN manualmente en el campo de arriba.</p>
            </div>
          )}
          {estado === 'error' && (
            <div className={styles.mensaje} role="alert">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" opacity="0.5" aria-hidden="true">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M12 8v5M12 16h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
              <p>No se pudo acceder a la cámara.</p>
              <p>Verificá los permisos del navegador e intentá de nuevo.</p>
            </div>
          )}
          {(estado === 'iniciando' || estado === 'escaneando') && (
            <div className={styles.videoWrap}>
              <video ref={videoRef} className={styles.video} muted playsInline />
              <div className={styles.marco}>
                <div className={styles.esquina} data-pos="tl" />
                <div className={styles.esquina} data-pos="tr" />
                <div className={styles.esquina} data-pos="bl" />
                <div className={styles.esquina} data-pos="br" />
                {estado === 'escaneando' && <div className={styles.lineaEscaneo} />}
              </div>
              {estado === 'iniciando' && (
                <div className={styles.cargando} role="status">Iniciando cámara...</div>
              )}
            </div>
          )}
        </div>

        <div className={styles.pie}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.8"/>
            <path d="M12 16v-4M12 8h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
          Apuntá al código de barras del libro
        </div>
      </div>
    </div>
  )
}
