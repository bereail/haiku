import { useEffect, useRef, useState } from 'react'
import { useDialogA11y } from '../hooks/useDialogA11y'
import { createIsbnDetector } from '../services/barcode'
import { isBookEan } from '../services/isbn'
import styles from './ISBNScanner.module.css'

type Estado = 'iniciando' | 'escaneando' | 'sinCamara' | 'permiso' | 'enUso' | 'lector' | 'error'

// Qué pasó con la cámara, según el error de getUserMedia
function estadoPorError(err: unknown): Estado {
  const name = (err as { name?: string } | null)?.name
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'permiso'
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'sinCamara'
  if (name === 'NotReadableError' || name === 'AbortError') return 'enUso'
  return 'error'
}

const MENSAJES: Partial<Record<Estado, [string, string]>> = {
  permiso: ['No diste permiso para usar la cámara.', 'Podés habilitarlo en la configuración del sitio en tu navegador, o ingresar el ISBN a mano.'],
  enUso: ['La cámara está ocupada por otra aplicación.', 'Cerrala y tocá «Reintentar», o ingresá el ISBN a mano.'],
  lector: ['No se pudo cargar el lector de códigos.', 'Revisá tu conexión y tocá «Reintentar», o ingresá el ISBN a mano.'],
  error: ['No se pudo acceder a la cámara.', 'Verificá los permisos del navegador o ingresá el ISBN a mano.'],
}

interface ISBNScannerProps {
  onScan: (isbn: string) => void
  onClose: () => void
}

// Escaneo por cámara con BarcodeDetector nativo o, si el navegador no lo trae, con un
// lector ZXing (WebAssembly) cargado de forma diferida. Solo acepta ISBN de libros
// (EAN-13 978/979 con dígito verificador correcto).
export default function ISBNScanner({ onScan, onClose }: ISBNScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)
  const stoppedRef = useRef(false)
  // El callback cambia en cada render de BookModal: si fuera dependencia del efecto, cada
  // re-render reiniciaba la cámara.
  const onScanRef = useRef(onScan)
  useEffect(() => { onScanRef.current = onScan }, [onScan])
  const [estado, setEstado] = useState<Estado>(() =>
    navigator.mediaDevices?.getUserMedia ? 'iniciando' : 'sinCamara'
  )
  const [aviso, setAviso] = useState('')
  const [intento, setIntento] = useState(0)

  const stop = () => {
    stoppedRef.current = true
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }

  useEffect(() => {
    if (!navigator.mediaDevices?.getUserMedia) return
    stoppedRef.current = false

    // Ante cualquier falla la cámara se apaga (antes, si fallaba la carga del lector o
    // video.play(), el stream quedaba abierto y la luz de la cámara encendida).
    const fallar = (e: Estado) => {
      const cerrado = stoppedRef.current
      stop()
      if (!cerrado) setEstado(e)
    }

    const iniciar = async () => {
      // En paralelo: pedir la cámara y cargar el lector (ZXing puede tardar en bajar)
      const [camara, lector] = await Promise.allSettled([
        navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } } }),
        createIsbnDetector(),
      ])
      if (camara.status === 'fulfilled') {
        if (stoppedRef.current) { camara.value.getTracks().forEach(t => t.stop()); return }
        streamRef.current = camara.value
      }
      if (camara.status === 'rejected') return fallar(estadoPorError(camara.reason))
      if (lector.status === 'rejected') return fallar('lector')
      const detector = lector.value
      try {
        const video = videoRef.current
        if (video) {
          video.srcObject = streamRef.current
          await video.play()
        }
        if (stoppedRef.current) return
        setEstado('escaneando')

        const loop = async () => {
          if (stoppedRef.current) return
          const v = videoRef.current
          if (v && v.readyState >= 2) {
            try {
              const codes = await detector.detect(v)
              const code = codes.map(c => c.rawValue).find(Boolean)
              if (code && isBookEan(code)) {
                stop()
                onScanRef.current(code)
                return
              }
              if (code) setAviso('Ese código no es el ISBN de un libro. Buscá el que empieza con 978 o 979.')
            } catch {
              // Algunos fotogramas fallan al decodificar: se reintenta con el siguiente
            }
          }
          rafRef.current = requestAnimationFrame(loop)
        }
        rafRef.current = requestAnimationFrame(loop)
      } catch {
        fallar('error')
      }
    }

    iniciar()
    return () => stop()
  }, [intento])

  const reintentar = () => {
    setAviso('')
    setEstado('iniciando')
    setIntento(i => i + 1)
  }

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
          {estado === 'sinCamara' && (
            <div className={styles.mensaje} role="status">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" opacity="0.5" aria-hidden="true">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M12 8v5M12 16h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
              <p>Este dispositivo no tiene una cámara disponible para escanear.</p>
              <p>Ingresá el ISBN manualmente en el campo de arriba.</p>
            </div>
          )}
          {MENSAJES[estado] && (
            <div className={styles.mensaje} role="alert">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" opacity="0.5" aria-hidden="true">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M12 8v5M12 16h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
              <p>{MENSAJES[estado]![0]}</p>
              <p>{MENSAJES[estado]![1]}</p>
              {estado !== 'permiso' && (
                <button type="button" className={styles.reintentarBtn} onClick={reintentar}>Reintentar</button>
              )}
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
                <div className={styles.cargando} role="status">Iniciando cámara y lector…</div>
              )}
              {aviso && <p className={styles.aviso} role="status">{aviso}</p>}
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
