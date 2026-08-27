import { useState, useCallback } from 'react'
import { useBooks } from './hooks/useBooks'
import { useGoal } from './hooks/useGoal'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { useToast } from './hooks/useToast'
import { draftToBookData, type VoiceDraft } from './hooks/useVoiceEntry'
import { api } from './api'
import LibraryPage from './pages/LibraryPage'
import BookModal from './components/BookModal'
import BookDetailModal from './components/BookDetailModal'
import BookSearchModal from './components/BookSearchModal'
import StatsModal from './components/StatsModal'
import CommunityModal from './components/CommunityModal'
import VoiceEntryFlow from './components/VoiceEntryFlow'
import ToastContainer from './components/Toast'
import type { Book } from './types'

interface Props {
  user: { email: string }
  onLogout: () => void
  dark: boolean
  onToggleTheme: () => void
  onOpenAdmin?: () => void
}

interface ModalState {
  mode: 'add' | 'edit'
  book?: Partial<Book> & { id?: string }
}

export default function LibraryMain({ user, onLogout, dark, onToggleTheme, onOpenAdmin }: Props) {
  const { books, loading, error, reload, addBook, updateBook, deleteBook, setBookCommunityPost, exportBooks, exportBooksHtml, importBooks } = useBooks(user.email)
  const isAdmin = !!onOpenAdmin
  const { goal, updateCount: updateGoal } = useGoal()
  const { toasts, addToast, removeToast } = useToast()

  const [modal, setModal] = useState<ModalState | null>(null)
  const [detailBook, setDetailBook] = useState<Book | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [statsOpen, setStatsOpen] = useState(false)
  const [communityOpen, setCommunityOpen] = useState(false)
  const [voiceOpen, setVoiceOpen] = useState(false)
  const [sharingBookId, setSharingBookId] = useState<string | null>(null)

  const openAdd = useCallback(() => setModal({ mode: 'add' }), [])
  const openSearch = useCallback(() => setSearchOpen(true), [])
  const openStats = useCallback(() => setStatsOpen(true), [])
  const openCommunity = useCallback(() => setCommunityOpen(true), [])
  const openVoice = useCallback(() => setVoiceOpen(true), [])

  const handleToggleCommunity = async (book: Book, share: boolean) => {
    if (share && !book.notes) {
      addToast('Agregá una anotación al libro antes de compartirlo', 'error')
      return
    }
    setSharingBookId(book.id)
    try {
      if (share) {
        const post = await api.post('/community/posts', { bookId: book.id, reflection: book.notes })
        setBookCommunityPost(book.id, post.id)
        setDetailBook(prev => prev && prev.id === book.id ? { ...prev, communityPostId: post.id } : prev)
        addToast('Compartido con la comunidad')
      } else {
        await api.delete(`/community/posts/${book.communityPostId}`)
        setBookCommunityPost(book.id, null)
        setDetailBook(prev => prev && prev.id === book.id ? { ...prev, communityPostId: null } : prev)
        addToast('Se dejó de compartir')
      }
    } catch (err) {
      addToast((err as Error).message, 'error')
    } finally {
      setSharingBookId(null)
    }
  }

  useKeyboardShortcuts([
    { key: 'n', handler: openAdd },
    { key: 'b', handler: openSearch },
    { key: 'e', handler: openStats },
    { key: 'v', handler: openVoice },
  ])

  const handleAddFromSearch = (bookData: {
    title?: string; author?: string; publisher?: string
    year?: number; coverLarge?: string; cover?: string
  }) => {
    setSearchOpen(false)
    setModal({
      mode: 'add',
      book: {
        title: bookData.title || '',
        author: bookData.author || '',
        publisher: bookData.publisher || '',
        year: bookData.year,
        cover: bookData.coverLarge || bookData.cover || '',
        genre: '',
        startDate: '',
        endDate: '',
        notes: '',
        score: 0,
        color: '',
      },
    })
  }

  const handleImport = async (file: File) => {
    if (!file) return
    try {
      const count = await importBooks(file)
      addToast(`Se importaron ${count} libros correctamente.`)
    } catch (err) {
      addToast((err as Error).message, 'error')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteBook(id)
    } catch (err) {
      addToast((err as Error).message, 'error')
    }
  }

  const handleEditVoiceDraft = (draft: VoiceDraft) => {
    setVoiceOpen(false)
    setModal({ mode: 'add', book: draftToBookData(draft) })
  }

  const handleUpdateFromVoiceDuplicate = (existing: Book, draft: VoiceDraft) => {
    setVoiceOpen(false)
    setModal({ mode: 'edit', book: { ...existing, ...draftToBookData(draft) } })
  }

  const handleViewVoiceDuplicate = (existing: Book) => {
    setVoiceOpen(false)
    setDetailBook(existing)
  }

  const handleSearchManuallyFromVoice = () => {
    setVoiceOpen(false)
    setSearchOpen(true)
  }

  return (
    <>
      <LibraryPage
        books={books}
        loading={loading}
        error={error}
        onRetry={reload}
        dark={dark}
        goal={goal}
        onToggleTheme={onToggleTheme}
        onLogout={onLogout}
        onAddBook={openAdd}
        onSearchBooks={openSearch}
        onVoiceEntry={openVoice}
        onViewBook={(book) => setDetailBook(book)}
        onEditBook={(book) => setModal({ mode: 'edit', book })}
        onDeleteBook={handleDelete}
        onShowStats={openStats}
        onOpenCommunity={openCommunity}
        isAdmin={isAdmin}
        onExportHtml={exportBooksHtml}
        onExport={isAdmin ? exportBooks : undefined}
        onImport={isAdmin ? handleImport : undefined}
        onOpenAdmin={onOpenAdmin}
        modal={
          modal && (
            <BookModal
              mode={modal.mode}
              book={modal.book}
              onSave={async (data) => {
                try {
                  if (modal.mode === 'add') await addBook(data)
                  else if (modal.book?.id) await updateBook(modal.book.id, data)
                  setModal(null)
                } catch (err) {
                  addToast((err as Error).message, 'error')
                }
              }}
              onClose={() => setModal(null)}
            />
          )
        }
      />

      {searchOpen && (
        <BookSearchModal
          onSelect={handleAddFromSearch}
          onClose={() => setSearchOpen(false)}
        />
      )}

      {statsOpen && (
        <StatsModal
          books={books}
          goal={goal}
          onUpdateGoal={updateGoal}
          onClose={() => setStatsOpen(false)}
        />
      )}

      {detailBook && (
        <BookDetailModal
          book={detailBook}
          onEdit={() => { setModal({ mode: 'edit', book: detailBook }); setDetailBook(null) }}
          onDelete={async () => {
            try { await handleDelete(detailBook.id); setDetailBook(null) }
            catch { /* toast already shown */ }
          }}
          onClose={() => setDetailBook(null)}
          onMarkRead={async () => {
            const today = new Date().toISOString().slice(0, 10)
            try {
              await updateBook(detailBook.id, { ...detailBook, endDate: today })
              setDetailBook(prev => prev ? { ...prev, endDate: today } : null)
              addToast('¡Libro marcado como leído!')
            } catch (err) {
              addToast((err as Error).message, 'error')
            }
          }}
          onToggleCommunity={share => handleToggleCommunity(detailBook, share)}
          sharingToCommunity={sharingBookId === detailBook.id}
        />
      )}

      {communityOpen && (
        <CommunityModal
          onClose={() => setCommunityOpen(false)}
          onToast={addToast}
        />
      )}

      {voiceOpen && (
        <VoiceEntryFlow
          books={books}
          onSave={async (data) => { await addBook(data); addToast('¡Lectura registrada!') }}
          onClose={() => setVoiceOpen(false)}
          onEditDraft={handleEditVoiceDraft}
          onSearchManually={handleSearchManuallyFromVoice}
          onViewDuplicate={handleViewVoiceDuplicate}
          onUpdateDuplicate={handleUpdateFromVoiceDuplicate}
        />
      )}

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </>
  )
}
