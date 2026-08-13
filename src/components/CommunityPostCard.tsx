import { useState } from 'react'
import StarRating from './StarRating'
import styles from './CommunityPostCard.module.css'
import { formatDateTime, getInitials } from '../utils'
import type { CommunityPost, CommunityComment } from '../types'

interface CommunityPostCardProps {
  post: CommunityPost
  onToggleLike: (post: CommunityPost) => void
  onDelete: (postId: string) => Promise<void>
  loadComments: (postId: string) => Promise<CommunityComment[]>
  onAddComment: (postId: string, body: string) => Promise<CommunityComment>
  onDeleteComment: (postId: string, commentId: string) => Promise<void>
}

const MAX_COMMENT_LEN = 500

export default function CommunityPostCard({
  post, onToggleLike, onDelete, loadComments, onAddComment, onDeleteComment,
}: CommunityPostCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [comments, setComments] = useState<CommunityComment[] | null>(null)
  const [loadingComments, setLoadingComments] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [posting, setPosting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const toggleExpanded = async () => {
    const next = !expanded
    setExpanded(next)
    if (next && comments === null) {
      setLoadingComments(true)
      try {
        setComments(await loadComments(post.id))
      } finally {
        setLoadingComments(false)
      }
    }
  }

  const handleAddComment = async () => {
    const body = commentText.trim()
    if (!body || posting) return
    setPosting(true)
    try {
      const comment = await onAddComment(post.id, body)
      setComments(prev => [...(prev ?? []), comment])
      setCommentText('')
    } finally {
      setPosting(false)
    }
  }

  const handleDeleteComment = async (commentId: string) => {
    await onDeleteComment(post.id, commentId)
    setComments(prev => (prev ?? []).filter(c => c.id !== commentId))
  }

  return (
    <article className={styles.card}>
      <div className={styles.header}>
        {post.bookCover ? (
          <img src={post.bookCover} alt="" className={styles.cover} />
        ) : (
          <div className={styles.coverPlaceholder}>
            <span>{getInitials(post.bookTitle)}</span>
          </div>
        )}
        <div className={styles.headerText}>
          <p className={styles.bookTitle}>{post.bookTitle}</p>
          {post.bookAuthor && <p className={styles.bookAuthor}>{post.bookAuthor}</p>}
          {!!post.bookScore && (
            <div className={styles.score}>
              <StarRating value={post.bookScore} readonly size={11} />
            </div>
          )}
        </div>
      </div>

      <p className={styles.reflection}>{post.reflection}</p>

      <div className={styles.meta}>
        <span className={styles.alias}>{post.authorAlias}</span>
        <span className={styles.dot}>·</span>
        <span className={styles.date}>{formatDateTime(post.createdAt)}</span>
      </div>

      <div className={styles.actions}>
        <button
          className={`${styles.actionBtn} ${post.likedByMe ? styles.liked : ''}`}
          onClick={() => onToggleLike(post)}
          aria-pressed={post.likedByMe}
          aria-label={post.likedByMe ? 'Quitar me gusta' : 'Dar me gusta'}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill={post.likedByMe ? 'currentColor' : 'none'} aria-hidden="true">
            <path d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.6l-1-1a5.5 5.5 0 00-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 000-7.8z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
          </svg>
          <span>{post.likeCount}</span>
        </button>

        <button className={styles.actionBtn} onClick={toggleExpanded} aria-expanded={expanded}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span>{post.commentCount}</span>
        </button>

        {post.canDelete && (
          confirmDelete ? (
            <span className={styles.confirmRow}>
              <span className={styles.confirmMsg}>¿Eliminar?</span>
              <button className={styles.confirmNo} onClick={() => setConfirmDelete(false)}>No</button>
              <button className={styles.confirmYes} onClick={() => onDelete(post.id)}>Sí</button>
            </span>
          ) : (
            <button className={styles.deleteBtn} onClick={() => setConfirmDelete(true)} aria-label="Eliminar publicación">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0l-1 14a2 2 0 01-2 2H7a2 2 0 01-2-2L4 6h16z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          )
        )}
      </div>

      {expanded && (
        <div className={styles.commentsBox}>
          {loadingComments && <p className={styles.commentsLoading}>Cargando comentarios…</p>}

          {!loadingComments && comments?.length === 0 && (
            <p className={styles.commentsEmpty}>Todavía no hay comentarios.</p>
          )}

          {!loadingComments && comments?.map(comment => (
            <div key={comment.id} className={styles.comment}>
              <div className={styles.commentBody}>
                <span className={styles.commentAlias}>{comment.authorAlias}</span>
                <p className={styles.commentText}>{comment.body}</p>
                <span className={styles.commentDate}>{formatDateTime(comment.createdAt)}</span>
              </div>
              {comment.canDelete && (
                <button
                  className={styles.commentDelete}
                  onClick={() => handleDeleteComment(comment.id)}
                  aria-label="Eliminar comentario"
                >
                  <svg width="12" height="12" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                    <path d="M2 2l14 14M16 2L2 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                  </svg>
                </button>
              )}
            </div>
          ))}

          <div className={styles.commentForm}>
            <textarea
              className={styles.commentInput}
              value={commentText}
              onChange={e => setCommentText(e.target.value.slice(0, MAX_COMMENT_LEN))}
              placeholder="Escribí un comentario..."
              rows={2}
              maxLength={MAX_COMMENT_LEN}
            />
            <div className={styles.commentFormFooter}>
              <span className={styles.commentCount}>{commentText.length}/{MAX_COMMENT_LEN}</span>
              <button
                className={styles.commentSubmit}
                onClick={handleAddComment}
                disabled={!commentText.trim() || posting}
              >
                Comentar
              </button>
            </div>
          </div>
        </div>
      )}
    </article>
  )
}
