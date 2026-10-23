import { useEffect, useRef, useState } from 'react'
import { useDialogA11y } from '../hooks/useDialogA11y'
import { useMarketplace, type MarketplaceFilters } from '../hooks/useMarketplace'
import { ACCEPTED_TYPES } from '../services/imageResize'
import type { Listing, ListingCondition, ListingInput, ListingKind, ListingPhoto, ListingStatus } from '../types'
import styles from './MarketplaceModal.module.css'

const MAX_PHOTOS = 4
const CONDITION_LABEL: Record<ListingCondition, string> = {
  nuevo: 'Nuevo', muy_bueno: 'Muy bueno', bueno: 'Bueno', aceptable: 'Aceptable',
}
const STATUS_LABEL: Record<ListingStatus, string> = { activa: 'Activa', pausada: 'Pausada', cerrada: 'Cerrada' }

interface MarketplaceModalProps {
  onClose: () => void
  onToast: (message: string, type?: 'success' | 'error' | 'info') => void
}

interface FormState {
  kind: ListingKind
  bookTitle: string
  bookAuthor: string
  condition: ListingCondition
  price: string
  description: string
  city: string
  contact: string
  photos: ListingPhoto[]
}

const EMPTY_FORM: FormState = {
  kind: 'venta', bookTitle: '', bookAuthor: '', condition: 'bueno', price: '',
  description: '', city: '', contact: '', photos: [],
}

function formatPrice(price: number, currency: string) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency, maximumFractionDigits: 2 }).format(price)
}

function toInput(f: FormState, status?: ListingStatus): ListingInput {
  return {
    kind: f.kind,
    condition: f.condition,
    bookTitle: f.bookTitle,
    bookAuthor: f.bookAuthor,
    price: f.kind === 'venta' ? f.price : null,
    description: f.description,
    city: f.city,
    contact: f.contact,
    status,
    photoIds: f.photos.map(p => p.id),
  }
}

function listingToForm(l: Listing): FormState {
  return {
    kind: l.kind, bookTitle: l.bookTitle, bookAuthor: l.bookAuthor ?? '', condition: l.condition,
    price: l.price === null ? '' : String(l.price), description: l.description ?? '', city: l.city ?? '',
    contact: l.contact ?? '', photos: l.photos,
  }
}

export default function MarketplaceModal({ onClose, onToast }: MarketplaceModalProps) {
  const { listings, loading, error, load, create, update, remove, uploadPhoto, discardPhoto } = useMarketplace()
  const [filters, setFilters] = useState<MarketplaceFilters>({ kind: '', q: '', mine: false })
  const [editing, setEditing] = useState<Listing | 'new' | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  // Fotos subidas en este formulario que todavía no se guardaron (se descartan al cancelar)
  const pendingUploads = useRef<Set<string>>(new Set())
  const dialogRef = useDialogA11y(onClose)

  useEffect(() => {
    const t = setTimeout(() => { load(filters) }, filters.q ? 300 : 0)
    return () => clearTimeout(t)
  }, [filters, load])

  // Si se cierra el modal con fotos subidas sin guardar, se descartan
  useEffect(() => () => {
    for (const id of pendingUploads.current) discardPhoto(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm(f => ({ ...f, [key]: value }))

  const openForm = (listing: Listing | 'new') => {
    setEditing(listing)
    setForm(listing === 'new' ? EMPTY_FORM : listingToForm(listing))
    setFormError('')
  }

  const closeForm = () => {
    for (const id of pendingUploads.current) discardPhoto(id)
    pendingUploads.current.clear()
    setEditing(null)
    setFormError('')
  }

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return
    const room = MAX_PHOTOS - form.photos.length
    const chosen = Array.from(files).slice(0, room)
    if (files.length > room) setFormError(`Podés agregar hasta ${MAX_PHOTOS} fotos por publicación.`)
    setUploading(true)
    try {
      for (const file of chosen) {
        const photo = await uploadPhoto(file)
        pendingUploads.current.add(photo.id)
        setForm(f => ({ ...f, photos: [...f.photos, photo] }))
      }
      if (files.length <= room) setFormError('')
    } catch (err) {
      setFormError((err as Error).message)
    } finally {
      setUploading(false)
    }
  }

  const removePhoto = (id: string) => {
    setForm(f => ({ ...f, photos: f.photos.filter(p => p.id !== id) }))
    if (pendingUploads.current.has(id)) {
      pendingUploads.current.delete(id)
      discardPhoto(id)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.bookTitle.trim()) {
      setFormError('El título del libro es obligatorio')
      document.getElementById('mk-title')?.focus()
      return
    }
    if (form.kind === 'venta' && form.price.trim() === '') {
      setFormError('Una venta necesita un precio')
      document.getElementById('mk-price')?.focus()
      return
    }
    setSaving(true)
    setFormError('')
    try {
      if (editing === 'new') {
        await create(toInput(form))
        onToast('Publicación creada')
      } else if (editing) {
        await update(editing.id, toInput(form, editing.status))
        onToast('Cambios guardados')
      }
      pendingUploads.current.clear() // ya quedaron asociadas
      setEditing(null)
      load(filters)
    } catch (err) {
      setFormError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const setStatus = async (l: Listing, status: ListingStatus) => {
    try {
      await update(l.id, toInput(listingToForm(l), status))
      onToast(status === 'activa' ? 'Publicación reactivada' : 'Publicación pausada')
      load(filters)
    } catch (err) {
      onToast((err as Error).message, 'error')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await remove(id)
      setConfirmDelete(null)
      onToast('Publicación eliminada')
    } catch (err) {
      onToast((err as Error).message, 'error')
    }
  }

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div ref={dialogRef} className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="marketplace-title" tabIndex={-1}>
        <div className={styles.header}>
          <div className={styles.headerText}>
            <h2 className={styles.title} id="marketplace-title">Mercado de libros</h2>
            <p className={styles.subtitle}>Venta e intercambio entre lectores (aparte de las reseñas de Comunidad).</p>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Cerrar">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <path d="M2 2l14 14M16 2L2 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {editing ? (
          <form className={styles.body} onSubmit={handleSubmit} noValidate aria-labelledby="mk-form-title">
            <h3 className={styles.formTitle} id="mk-form-title">{editing === 'new' ? 'Publicar un libro' : 'Editar publicación'}</h3>

            <fieldset className={styles.fieldset}>
              <legend className={styles.label}>Tipo</legend>
              <div className={styles.radioRow}>
                {(['venta', 'intercambio'] as ListingKind[]).map(k => (
                  <label key={k} className={styles.radio}>
                    <input type="radio" name="mk-kind" value={k} checked={form.kind === k} onChange={() => set('kind', k)} />
                    {k === 'venta' ? 'Venta' : 'Intercambio'}
                  </label>
                ))}
              </div>
            </fieldset>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="mk-title">Título del libro *</label>
              <input id="mk-title" className={styles.input} value={form.bookTitle} maxLength={200}
                onChange={e => set('bookTitle', e.target.value)} aria-invalid={formError.startsWith('El título') || undefined} />
            </div>
            <div className={styles.row2}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="mk-author">Autor/a</label>
                <input id="mk-author" className={styles.input} value={form.bookAuthor} maxLength={150} onChange={e => set('bookAuthor', e.target.value)} />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="mk-condition">Estado del libro</label>
                <select id="mk-condition" className={styles.input} value={form.condition} onChange={e => set('condition', e.target.value as ListingCondition)}>
                  {(Object.keys(CONDITION_LABEL) as ListingCondition[]).map(c => <option key={c} value={c}>{CONDITION_LABEL[c]}</option>)}
                </select>
              </div>
            </div>
            {form.kind === 'venta' && (
              <div className={styles.field}>
                <label className={styles.label} htmlFor="mk-price">Precio (ARS) *</label>
                <input id="mk-price" className={styles.input} type="number" inputMode="decimal" min="0" step="0.01"
                  value={form.price} onChange={e => set('price', e.target.value)} aria-invalid={formError.includes('precio') || undefined} />
              </div>
            )}
            <div className={styles.field}>
              <label className={styles.label} htmlFor="mk-description">Descripción</label>
              <textarea id="mk-description" className={styles.textarea} rows={3} maxLength={2000} value={form.description}
                onChange={e => set('description', e.target.value)} placeholder="Edición, detalles, qué te interesa a cambio…" />
            </div>
            <div className={styles.row2}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="mk-city">Ciudad o barrio</label>
                <input id="mk-city" className={styles.input} value={form.city} maxLength={80} onChange={e => set('city', e.target.value)} />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="mk-contact">Contacto</label>
                <input id="mk-contact" className={styles.input} value={form.contact} maxLength={200}
                  onChange={e => set('contact', e.target.value)} aria-describedby="mk-contact-hint" />
                <p className={styles.hint} id="mk-contact-hint">Lo ven todas las personas con cuenta en Librook. No pongas datos que no quieras compartir.</p>
              </div>
            </div>

            <div className={styles.field}>
              <span className={styles.label} id="mk-photos-label">Fotos ({form.photos.length}/{MAX_PHOTOS})</span>
              {form.photos.length > 0 && (
                <ul className={styles.photoList} aria-labelledby="mk-photos-label">
                  {form.photos.map((p, i) => (
                    <li key={p.id} className={styles.photoItem}>
                      <img src={p.url} alt={`Foto ${i + 1}`} className={styles.photoThumb} />
                      <button type="button" className={styles.photoRemove} onClick={() => removePhoto(p.id)} aria-label={`Quitar foto ${i + 1}`}>×</button>
                    </li>
                  ))}
                </ul>
              )}
              {form.photos.length < MAX_PHOTOS && (
                <label className={styles.fileBtn}>
                  <input type="file" accept={ACCEPTED_TYPES.join(',')} multiple disabled={uploading}
                    onChange={e => { handleFiles(e.target.files); e.target.value = '' }} />
                  Agregar fotos
                </label>
              )}
              {uploading && <p className={styles.status} role="status">Subiendo foto…</p>}
            </div>

            {formError && <p className={styles.error} role="alert">{formError}</p>}

            <div className={styles.formActions}>
              <button type="button" className={styles.secondaryBtn} onClick={closeForm}>Cancelar</button>
              <button type="submit" className={styles.primaryBtn} disabled={saving || uploading}>
                {saving ? 'Guardando…' : editing === 'new' ? 'Publicar' : 'Guardar cambios'}
              </button>
            </div>
          </form>
        ) : (
          <div className={styles.body}>
            <div className={styles.toolbar}>
              <div className={styles.filterGroup} role="group" aria-label="Tipo de publicación">
                {([['', 'Todo'], ['venta', 'Venta'], ['intercambio', 'Intercambio']] as [ListingKind | '', string][]).map(([k, label]) => (
                  <button key={label} type="button" className={styles.filterBtn} aria-pressed={filters.kind === k}
                    onClick={() => setFilters(f => ({ ...f, kind: k }))}>{label}</button>
                ))}
                <button type="button" className={styles.filterBtn} aria-pressed={filters.mine}
                  onClick={() => setFilters(f => ({ ...f, mine: !f.mine }))}>Mis publicaciones</button>
              </div>
              <div className={styles.searchRow}>
                <label className={styles.srOnly} htmlFor="mk-search">Buscar por título o autor</label>
                <input id="mk-search" className={styles.input} type="search" placeholder="Buscar por título o autor…"
                  value={filters.q} onChange={e => setFilters(f => ({ ...f, q: e.target.value }))} />
                <button type="button" className={styles.primaryBtn} onClick={() => openForm('new')}>Publicar un libro</button>
              </div>
            </div>

            {loading && <p className={styles.status} role="status">Cargando…</p>}
            {error && <p className={styles.error} role="alert">{error}</p>}
            {!loading && !error && listings.length === 0 && (
              <p className={styles.empty}>{filters.mine ? 'Todavía no publicaste nada.' : 'No hay publicaciones con estos filtros.'}</p>
            )}

            <div className={styles.list}>
              {listings.map(l => (
                <article key={l.id} className={styles.card} aria-labelledby={`mk-l-${l.id}`}>
                  {l.photos.length > 0 && (
                    <div className={styles.cardPhotos}>
                      {l.photos.map((p, i) => (
                        <img key={p.id} src={p.url} alt={`Foto ${i + 1} de ${l.bookTitle}`} className={styles.cardPhoto} loading="lazy" />
                      ))}
                    </div>
                  )}
                  <div className={styles.cardBody}>
                    <div className={styles.badges}>
                      <span className={styles.badge}>{l.kind === 'venta' ? 'Venta' : 'Intercambio'}</span>
                      <span className={styles.badgeSoft}>{CONDITION_LABEL[l.condition]}</span>
                      {l.status !== 'activa' && <span className={styles.badgeMuted}>{STATUS_LABEL[l.status]}</span>}
                    </div>
                    <h3 className={styles.cardTitle} id={`mk-l-${l.id}`}>{l.bookTitle}</h3>
                    {l.bookAuthor && <p className={styles.cardMeta}>{l.bookAuthor}</p>}
                    {l.price !== null && <p className={styles.price}>{formatPrice(l.price, l.currency)}</p>}
                    {l.description && <p className={styles.description}>{l.description}</p>}
                    <dl className={styles.details}>
                      {l.city && (<><dt>Lugar</dt><dd>{l.city}</dd></>)}
                      <dt>Publica</dt><dd>{l.isMine ? 'Vos' : l.sellerAlias}</dd>
                      {l.contact && (<><dt>Contacto</dt><dd>{l.contact}</dd></>)}
                    </dl>
                    {(l.isMine || l.canDelete) && (
                      <div className={styles.cardActions}>
                        {l.isMine && <button type="button" className={styles.secondaryBtn} onClick={() => openForm(l)}>Editar</button>}
                        {l.isMine && l.status === 'activa' && <button type="button" className={styles.secondaryBtn} onClick={() => setStatus(l, 'pausada')}>Pausar</button>}
                        {l.isMine && l.status !== 'activa' && <button type="button" className={styles.secondaryBtn} onClick={() => setStatus(l, 'activa')}>Reactivar</button>}
                        {l.canDelete && (confirmDelete === l.id ? (
                          <span className={styles.confirmRow}>
                            <span>¿Eliminar?</span>
                            <button type="button" className={styles.secondaryBtn} onClick={() => setConfirmDelete(null)}>No</button>
                            <button type="button" className={styles.dangerBtn} onClick={() => handleDelete(l.id)}>Sí, eliminar</button>
                          </span>
                        ) : (
                          <button type="button" className={styles.dangerBtn} onClick={() => setConfirmDelete(l.id)}>Eliminar</button>
                        ))}
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
