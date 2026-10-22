import { useEffect, useRef, useState } from 'react'
import { useCommunity } from '../hooks/useCommunity'
import { useDialogA11y } from '../hooks/useDialogA11y'
import CommunityPostCard from './CommunityPostCard'
import styles from './CommunityModal.module.css'
import type { CommunityPost } from '../types'

interface CommunityModalProps {
  onClose: () => void
  onToast: (message: string, type?: 'success' | 'error' | 'info') => void
}

export default function CommunityModal({ onClose, onToast }: CommunityModalProps) {
  const {
    posts, loading, hasMore, initialized,
    loadMore, deletePost, toggleLike, loadComments, addComment, deleteComment,
    getProfile, updateAlias,
  } = useCommunity()

  const [alias, setAlias] = useState('')
  const [editingAlias, setEditingAlias] = useState(false)
  const [aliasInput, setAliasInput] = useState('')
  const [savingAlias, setSavingAlias] = useState(false)
  const hasLoadedRef = useRef(false)
  const dialogRef = useDialogA11y(onClose)

  useEffect(() => {
    if (hasLoadedRef.current) return
    hasLoadedRef.current = true
    loadMore()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    getProfile().then(p => setAlias(p.alias)).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleDelete = async (postId: string) => {
    try {
      await deletePost(postId)
      onToast('Publicación eliminada')
    } catch (err) {
      onToast((err as Error).message, 'error')
    }
  }

  const handleToggleLike = (post: CommunityPost) => {
    toggleLike(post).catch(err => onToast((err as Error).message, 'error'))
  }

  const handleAddComment = async (postId: string, body: string) => {
    try {
      return await addComment(postId, body)
    } catch (err) {
      onToast((err as Error).message, 'error')
      throw err
    }
  }

  const handleDeleteComment = async (postId: string, commentId: string) => {
    try {
      await deleteComment(postId, commentId)
    } catch (err) {
      onToast((err as Error).message, 'error')
    }
  }

  const startEditAlias = () => {
    setAliasInput(alias)
    setEditingAlias(true)
  }

  const saveAlias = async () => {
    setSavingAlias(true)
    try {
      const result = await updateAlias(aliasInput.trim())
      setAlias(result.alias)
      setEditingAlias(false)
      onToast('Alias actualizado')
    } catch (err) {
      onToast((err as Error).message, 'error')
    } finally {
      setSavingAlias(false)
    }
  }

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div ref={dialogRef} className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="community-title" tabIndex={-1}>
        <div className={styles.header}>
          <div className={styles.headerText}>
            <h2 className={styles.title} id="community-title">Comunidad</h2>
            {editingAlias ? (
              <div className={styles.aliasEdit}>
                <input
                  className={styles.aliasInput}
                  value={aliasInput}
                  onChange={e => setAliasInput(e.target.value.slice(0, 30))}
                  placeholder="Tu alias"
                  aria-label="Tu alias"
                  maxLength={30}
                  autoFocus
                />
                <button className={styles.aliasSave} onClick={saveAlias} disabled={savingAlias}>
                  Guardar
                </button>
                <button className={styles.aliasCancel} onClick={() => setEditingAlias(false)}>
                  Cancelar
                </button>
              </div>
            ) : (
              <p className={styles.aliasRow}>
                Publicás como <strong>{alias}</strong>
                <button className={styles.aliasEditBtn} onClick={startEditAlias}>Editar</button>
              </p>
            )}
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Cerrar">
            <svg width="17" height="17" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <path d="M2 2l14 14M16 2L2 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div className={styles.body}>
          {loading && posts.length === 0 && (
            <div className={styles.loadingState} role="status" aria-live="polite">
              <svg className={styles.spinner} width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" strokeOpacity="0.2"/>
                <path d="M21 12a9 9 0 00-9-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              <p className={styles.loadingMsg}>Cargando reflexiones…</p>
            </div>
          )}

          {!loading && initialized && posts.length === 0 && (
            <div className={styles.empty}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" opacity="0.18" aria-hidden="true">
                <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <p className={styles.emptyTitle}>Todavía no hay reflexiones compartidas</p>
              <p className={styles.emptySub}>Compartí una desde el detalle de un libro que hayas leído.</p>
            </div>
          )}

          {posts.length > 0 && (
            <div className={styles.feed}>
              {posts.map(post => (
                <CommunityPostCard
                  key={post.id}
                  post={post}
                  onToggleLike={handleToggleLike}
                  onDelete={handleDelete}
                  loadComments={loadComments}
                  onAddComment={handleAddComment}
                  onDeleteComment={handleDeleteComment}
                />
              ))}
            </div>
          )}

          {initialized && hasMore && (
            <button className={styles.loadMoreBtn} onClick={() => loadMore()} disabled={loading}>
              {loading ? 'Cargando…' : 'Cargar más'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
