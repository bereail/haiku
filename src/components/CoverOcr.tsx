import { useEffect, useRef, useState } from 'react'
import { useDialogA11y } from '../hooks/useDialogA11y'
import { searchBooksOnce, type BookSuggestion } from '../hooks/useBookSearch'
import { queryFromLines, recognizeCover } from '../services/ocr'
import styles from './CoverOcr.module.css'

type Paso = 'elegir' | 'leyendo' | 'resultado' | 'error'

interface CoverOcrProps {
  onPick: (book: BookSuggestion) => void
  onClose: () => void
}

// Identificar un libro por la foto de su tapa: OCR local (la foto no sale del dispositivo),
// búsqueda en Open Library con el texto reconocido y confirmación de la persona. Nunca se
// guarda nada automáticamente: elegir un candidato solo completa el formulario.
export default function CoverOcr({ onPick, onClose }: CoverOcrProps) {
  const [paso, setPaso] = useState<Paso>('elegir')
  const [preview, setPreview] = useState<string | null>(null)
  const [progreso, setProgreso] = useState({ fraction: 0, step: '' })
  const [query, setQuery] = useState('')
  const [candidatos, setCandidatos] = useState<BookSuggestion[] | null>(null)
  const [buscando, setBuscando] = useState(false)
  const [error, setError] = useState('')
  const [tiempos, setTiempos] = useState<{ loadMs: number; recognizeMs: number } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const dialogRef = useDialogA11y(onClose)

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])

  const buscar = async (q: string) => {
    if (!q.trim()) return
    setBuscando(true)
    setError('')
    try {
      setCandidatos(await searchBooksOnce(q))
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBuscando(false)
    }
  }

  const leer = async (file: File | undefined) => {
    if (!file) return
    setPreview(prev => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(file) })
    setPaso('leyendo')
    setCandidatos(null)
    setError('')
    try {
      const r = await recognizeCover(file, (fraction, step) => setProgreso({ fraction, step }))
      setTiempos(r.timings)
      const q = queryFromLines(r.lines)
      setQuery(q)
      setPaso('resultado')
      if (q) await buscar(q)
    } catch {
      setError('No se pudo leer la foto. Probá con otra más nítida o buscá por título.')
      setPaso('error')
    }
  }

  const volverAFotografiar = () => {
    setPaso('elegir')
    setCandidatos(null)
    setQuery('')
    setError('')
    fileRef.current?.click()
  }

  const porcentaje = Math.round(progreso.fraction * 100)
  const descargando = /load|initializ/i.test(progreso.step)

  return (
    <div className={styles.overlay}>
      <div ref={dialogRef} className={styles.container} role="dialog" aria-modal="true" aria-labelledby="cover-ocr-title" tabIndex={-1}>
        <div className={styles.header}>
          <h3 className={styles.title} id="cover-ocr-title">Identificar por foto de la tapa</h3>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Cerrar">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <path d="M2 2l14 14M16 2L2 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div className={styles.body}>
          <p className={styles.note}>La foto se procesa en tu dispositivo: no se envía a ningún servidor.</p>

          {preview && <img src={preview} alt="Foto de la tapa elegida" className={styles.preview} />}

          {paso === 'elegir' && (
            <label className={styles.primaryBtn}>
              <input ref={fileRef} type="file" accept="image/*" capture="environment" className={styles.hiddenInput}
                onChange={e => { leer(e.target.files?.[0]); e.target.value = '' }} />
              Sacar o elegir una foto de la tapa
            </label>
          )}

          {paso === 'leyendo' && (
            <div role="status" className={styles.status}>
              <p>{descargando ? 'Preparando el lector (la primera vez descarga unos 6 MB)…' : 'Leyendo la tapa…'}</p>
              <div className={styles.bar} role="progressbar" aria-label="Progreso de lectura" aria-valuemin={0} aria-valuemax={100} aria-valuenow={porcentaje}>
                <div className={styles.barFill} style={{ width: `${porcentaje}%` }} />
              </div>
            </div>
          )}

          {paso === 'resultado' && (
            <>
              <p className={styles.warning}>El reconocimiento no es infalible: confirmá que sea el libro correcto antes de usarlo.</p>
              <form className={styles.searchRow} onSubmit={e => { e.preventDefault(); buscar(query) }}>
                <label className={styles.label} htmlFor="cover-ocr-query">Texto reconocido (podés corregirlo)</label>
                <div className={styles.inline}>
                  <input id="cover-ocr-query" className={styles.input} value={query} onChange={e => setQuery(e.target.value)}
                    placeholder="Título o autor" />
                  <button type="submit" className={styles.secondaryBtn} disabled={buscando || !query.trim()}>Buscar</button>
                </div>
              </form>
              {!query && <p className={styles.status}>No se reconoció texto en la foto. Escribí el título o el autor para buscar.</p>}
              {buscando && <p className={styles.status} role="status">Buscando…</p>}
              {candidatos && !buscando && (
                candidatos.length === 0
                  ? <p className={styles.status} role="status">No encontramos coincidencias. Corregí el texto o probá con otra foto.</p>
                  : (
                    <ul className={styles.candidates} aria-label="Posibles libros">
                      {candidatos.map(c => (
                        <li key={c.key} className={styles.candidate}>
                          <div className={styles.candidateText}>
                            <strong>{c.title}</strong>
                            {c.author && <span>{c.author}{c.year ? ` · ${c.year}` : ''}</span>}
                          </div>
                          <button type="button" className={styles.primaryBtn} onClick={() => onPick(c)} aria-label={`Usar este libro: ${c.title}`}>
                            Usar este libro
                          </button>
                        </li>
                      ))}
                    </ul>
                  )
              )}
              {tiempos && <p className={styles.timing}>Lectura: {(tiempos.recognizeMs / 1000).toFixed(1)} s</p>}
            </>
          )}

          {error && <p className={styles.error} role="alert">{error}</p>}

          {(paso === 'resultado' || paso === 'error') && (
            <div className={styles.actions}>
              <button type="button" className={styles.secondaryBtn} onClick={volverAFotografiar}>Volver a fotografiar</button>
              <button type="button" className={styles.secondaryBtn} onClick={onClose}>Buscar a mano por título o autor</button>
            </div>
          )}
          {paso !== 'elegir' && (
            <input ref={fileRef} type="file" accept="image/*" capture="environment" className={styles.hiddenInput} tabIndex={-1} aria-hidden="true"
              onChange={e => { leer(e.target.files?.[0]); e.target.value = '' }} />
          )}
        </div>
      </div>
    </div>
  )
}
