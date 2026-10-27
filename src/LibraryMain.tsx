import { useState, useCallback, useMemo } from 'react'
import { useBooks } from './hooks/useBooks'
import { useGoal } from './hooks/useGoal'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { useToast } from './hooks/useToast'
import { draftToBookData, type VoiceDraft } from './hooks/useVoiceEntry'
import { api } from './api'
import { todayLocal } from './utils'
import { planQuickAdd, quickAddMessage, type QuickAddSource, type QuickTarget } from './services/quickAdd'
import LibraryPage from './pages/LibraryPage'
import BookModal from './components/BookModal'
import BookDetailModal from './components/BookDetailModal'
import BookSearchModal from './components/BookSearchModal'
import StatsModal from './components/StatsModal'
import CommunityModal from './components/CommunityModal'
import DiscoverModal from './components/DiscoverModal'
import MarketplaceModal from './components/MarketplaceModal'
import VoiceEntryFlow from './components/VoiceEntryFlow'
import ToastContainer from './components/Toast'
import Tour, { TourInvite, type TourEnd } from './components/Tour'
import { stepsFor } from './tour/tourSteps'
import { getTourPreference, isTourPostponed, postponeTour, setTourPreference } from './tour/tourStorage'
import type { Book } from './types'

interface Props {
  user: { email: string; isDemo?: boolean }
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
  const [discoverOpen, setDiscoverOpen] = useState(false)
  const [communityOpen, setCommunityOpen] = useState(false)
  const [marketplaceOpen, setMarketplaceOpen] = useState(false)
  const [voiceOpen, setVoiceOpen] = useState(false)
  const [sharingBookId, setSharingBookId] = useState<string | null>(null)

  const openAdd = useCallback(() => setModal({ mode: 'add' }), [])
  const openSearch = useCallback(() => setSearchOpen(true), [])
  const openStats = useCallback(() => setStatsOpen(true), [])
  const openDiscover = useCallback(() => setDiscoverOpen(true), [])
  const openCommunity = useCallback(() => setCommunityOpen(true), [])
  const openMarketplace = useCallback(() => setMarketplaceOpen(true), [])
  const openVoice = useCallback(() => setVoiceOpen(true), [])

  // Tutorial: se invita una vez por persona (en este navegador); siempre se puede
  // volver a abrir desde «Ver tutorial».
  const tourSteps = useMemo(() => stepsFor({ isAdmin }), [isAdmin])
  const [tourOpen, setTourOpen] = useState(false)
  const [tourInvite, setTourInvite] = useState(() => !getTourPreference(user.email) && !isTourPostponed())
  const startTour = useCallback(() => { setTourInvite(false); setTourOpen(true) }, [])
  const endTour = useCallback((how: TourEnd) => {
    setTourOpen(false)
    setTourPreference(user.email, how === 'finished' ? 'done' : 'dismissed')
  }, [user.email])

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

  // "Leído" / "Pendiente" en los resultados de Open Library: guardan directo,
  // sin duplicar si el libro ya está (ver planQuickAdd). Los errores (red,
  // demo de solo lectura, sesión vencida) se propagan para que el resultado
  // los muestre y permita reintentar.
  const handleQuickAdd = async (source: QuickAddSource, target: QuickTarget): Promise<string> => {
    const plan = planQuickAdd(books, source, target, todayLocal())
    if (plan.kind === 'create') await addBook(plan.data)
    else if (plan.kind === 'update') await updateBook(plan.book.id, plan.data)
    return quickAddMessage(plan, target)
  }

  const handleImport = async (file: File) => {
    if (!file) return
    try {
      const r = await importBooks(file)
      if (r.imported === r.total) {
        addToast(`Se importaron ${r.imported} libros correctamente.`)
      } else {
        const parts = [`Se importaron ${r.imported} de ${r.total} libros.`]
        if (r.skippedDuplicates) parts.push(`${r.skippedDuplicates} ya estaban en tu biblioteca.`)
        if (r.failed.length) parts.push(`${r.failed.length} no se pudieron importar: ${r.failed.map(f => `${f.title} (${f.reason})`).join('; ')}.`)
        addToast(parts.join(' '), r.failed.length ? 'error' : 'success')
      }
      if (r.withoutCover.length) {
        addToast(`${r.withoutCover.length} se importaron sin tapa (formato no admitido): ${r.withoutCover.join(', ')}.`)
      }
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
        onOpenDiscover={openDiscover}
        onOpenCommunity={openCommunity}
        onOpenMarketplace={openMarketplace}
        isAdmin={isAdmin}
        isDemo={user.isDemo}
        onExportHtml={exportBooksHtml}
        onExport={isAdmin ? exportBooks : undefined}
        onImport={isAdmin ? handleImport : undefined}
        onOpenAdmin={onOpenAdmin}
        onStartTour={startTour}
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
          onQuickAdd={handleQuickAdd}
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
            const today = todayLocal()
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

      {discoverOpen && (
        <DiscoverModal
          onClose={() => setDiscoverOpen(false)}
          onOpenCommunity={() => { setDiscoverOpen(false); openCommunity() }}
        />
      )}

      {communityOpen && (
        <CommunityModal
          onClose={() => setCommunityOpen(false)}
          onToast={addToast}
        />
      )}

      {marketplaceOpen && (
        <MarketplaceModal
          onClose={() => setMarketplaceOpen(false)}
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

      {tourInvite && !tourOpen && !loading && !error && (
        <TourInvite
          onStart={startTour}
          onLater={() => { postponeTour(); setTourInvite(false) }}
          onDismiss={() => { setTourPreference(user.email, 'dismissed'); setTourInvite(false) }}
        />
      )}

      {tourOpen && <Tour steps={tourSteps} isDemo={!!user.isDemo} onEnd={endTour} />}

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </>
  )
}
