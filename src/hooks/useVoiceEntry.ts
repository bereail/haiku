import { useCallback, useRef, useState } from 'react'
import { SpeechService, isSpeechRecognitionSupported, type SpeechErrorKind } from '../services/speechService'
import { parseVoiceEntry } from '../services/voiceBookParser'
import { findBookMatches } from '../services/bookMatchService'
import type { BookSuggestion } from './useBookSearch'
import type { Book, ReadingStatus } from '../types'

export type VoicePhase =
  | 'idle' | 'listening' | 'processing' | 'searching'
  | 'picking' | 'duplicate' | 'confirm' | 'saving' | 'saved' | 'error'

export type VoiceErrorKind = SpeechErrorKind | 'no-match'

export interface VoiceDraft {
  title: string
  author: string
  cover: string
  publisher: string
  year: number | null
  status: ReadingStatus
  rating: number | null
  review: string
  progress: number | null
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

export function draftToBookData(draft: VoiceDraft): Omit<Book, 'id' | 'createdAt'> {
  const today = todayISO()
  const base = {
    title: draft.title.trim(),
    author: draft.author.trim(),
    cover: draft.cover,
    publisher: draft.publisher,
    year: draft.year ?? undefined,
    score: draft.rating ?? 0,
    notes: draft.review,
  }
  switch (draft.status) {
    case 'read':
      return { ...base, startDate: today, endDate: today, abandoned: false }
    case 'reading':
      return { ...base, startDate: today, endDate: '', abandoned: false }
    case 'abandoned':
      return { ...base, startDate: today, endDate: '', abandoned: true }
    default:
      return { ...base, startDate: '', endDate: '', abandoned: false }
  }
}

const COMBINING_MARKS = new RegExp('[\\u0300-\\u036f]', 'g')

function normalizeForCompare(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(COMBINING_MARKS, '').trim()
}

function findDuplicate(books: Book[], title: string, author: string): Book | null {
  const t = normalizeForCompare(title)
  if (!t) return null
  const a = normalizeForCompare(author)
  return books.find(b => {
    if (normalizeForCompare(b.title) !== t) return false
    if (!a) return true
    return normalizeForCompare(b.author || '') === a
  }) || null
}

export interface UseVoiceEntryOptions {
  books: Book[]
  onSave: (data: Omit<Book, 'id' | 'createdAt'>) => Promise<void>
}

export function useVoiceEntry({ books, onSave }: UseVoiceEntryOptions) {
  const [phase, setPhase] = useState<VoicePhase>('idle')
  const [transcript, setTranscript] = useState('')
  const [candidates, setCandidates] = useState<BookSuggestion[]>([])
  const [draft, setDraft] = useState<VoiceDraft | null>(null)
  const [duplicateBook, setDuplicateBook] = useState<Book | null>(null)
  const [errorKind, setErrorKind] = useState<VoiceErrorKind | null>(null)

  const serviceRef = useRef<SpeechService | null>(null)
  const transcriptRef = useRef('')
  const parsedTitleRef = useRef<string | null>(null)
  const parsedAuthorRef = useRef<string | null>(null)
  const parsedStatusRef = useRef<ReadingStatus | null>(null)
  const parsedRatingRef = useRef<number | null>(null)
  const parsedReviewRef = useRef<string | null>(null)
  const parsedProgressRef = useRef<number | null>(null)

  const buildDraft = useCallback((match: BookSuggestion | null) => {
    const status = (parsedStatusRef.current ?? 'pending') as ReadingStatus
    const next: VoiceDraft = {
      title: match?.title || parsedTitleRef.current || '',
      author: match?.author || parsedAuthorRef.current || '',
      cover: match?.coverLarge || match?.cover || '',
      publisher: match?.publisher || '',
      year: match?.year ?? null,
      status,
      rating: parsedRatingRef.current,
      review: parsedReviewRef.current || '',
      progress: parsedProgressRef.current,
    }
    return next
  }, [])

  const goToResult = useCallback(async () => {
    const title = parsedTitleRef.current
    if (!title) {
      setErrorKind('no-match')
      setPhase('error')
      return
    }
    setPhase('searching')
    try {
      const { best, candidates: found } = await findBookMatches(title, parsedAuthorRef.current)
      if (best) {
        const d = buildDraft(best)
        const dup = findDuplicate(books, d.title, d.author)
        if (dup) { setDuplicateBook(dup); setDraft(d); setPhase('duplicate'); return }
        setDraft(d)
        setPhase('confirm')
      } else if (found.length > 0) {
        setCandidates(found)
        setPhase('picking')
      } else {
        const d = buildDraft(null)
        const dup = findDuplicate(books, d.title, d.author)
        if (dup) { setDuplicateBook(dup); setDraft(d); setPhase('duplicate'); return }
        setDraft(d)
        setPhase('confirm')
      }
    } catch {
      setErrorKind('unknown')
      setPhase('error')
    }
  }, [books, buildDraft])

  const processTranscript = useCallback((text: string) => {
    setPhase('processing')
    const parsed = parseVoiceEntry(text)
    if (!parsed.title) {
      setErrorKind('no-match')
      setPhase('error')
      return
    }
    parsedTitleRef.current = parsed.title
    parsedAuthorRef.current = parsed.author
    parsedStatusRef.current = parsed.status
    parsedRatingRef.current = parsed.rating
    parsedReviewRef.current = parsed.review
    parsedProgressRef.current = parsed.progress
    void goToResult()
  }, [goToResult])

  const start = useCallback(() => {
    setErrorKind(null)
    setTranscript('')
    if (!isSpeechRecognitionSupported()) {
      setErrorKind('no-support')
      setPhase('error')
      return
    }
    setPhase('listening')
    transcriptRef.current = ''
    const service = new SpeechService()
    serviceRef.current = service
    service.start({
      onResult: (text) => { transcriptRef.current = text; setTranscript(text) },
      onError: (kind) => {
        setErrorKind(kind)
        setPhase('error')
      },
      onEnd: () => {
        if (transcriptRef.current.trim()) processTranscript(transcriptRef.current)
      },
    })
  }, [processTranscript])

  const stopListening = useCallback(() => {
    serviceRef.current?.stop()
  }, [])

  const pickCandidate = useCallback((s: BookSuggestion) => {
    const d = buildDraft(s)
    const dup = findDuplicate(books, d.title, d.author)
    if (dup) { setDuplicateBook(dup); setDraft(d); setPhase('duplicate'); return }
    setDraft(d)
    setPhase('confirm')
  }, [books, buildDraft])

  const updateDraft = useCallback((patch: Partial<VoiceDraft>) => {
    setDraft(d => d ? { ...d, ...patch } : d)
  }, [])

  const proceedAnyway = useCallback(() => {
    setDuplicateBook(null)
    setPhase('confirm')
  }, [])

  const confirmSave = useCallback(async () => {
    if (!draft) return
    setPhase('saving')
    try {
      await onSave(draftToBookData(draft))
      setPhase('saved')
    } catch {
      setErrorKind('unknown')
      setPhase('error')
    }
  }, [draft, onSave])

  const reset = useCallback(() => {
    serviceRef.current?.abort()
    serviceRef.current = null
    transcriptRef.current = ''
    parsedTitleRef.current = null
    parsedAuthorRef.current = null
    parsedStatusRef.current = null
    parsedRatingRef.current = null
    parsedReviewRef.current = null
    parsedProgressRef.current = null
    setPhase('idle')
    setTranscript('')
    setCandidates([])
    setDraft(null)
    setDuplicateBook(null)
    setErrorKind(null)
  }, [])

  const retry = useCallback(() => {
    setErrorKind(null)
    setDraft(null)
    setCandidates([])
    setPhase('idle')
  }, [])

  return {
    phase, transcript, candidates, draft, duplicateBook, errorKind,
    start, stopListening, pickCandidate, updateDraft, confirmSave,
    proceedAnyway, reset, retry,
  }
}
