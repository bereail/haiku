// Interpreta lenguaje natural (transcripción de voz o texto libre) sobre una lectura,
// y devuelve únicamente los campos que la persona mencionó explícitamente.
//
// Regla central: NUNCA inventar. Si algo no se dijo, el campo queda `null`/`undefined`
// en vez de completarse con un valor supuesto. La búsqueda bibliográfica (otro servicio)
// es la encargada de enriquecer autor/tapa/editorial una vez que se tiene un título.
import type { ReadingStatus } from '../types'

export interface ParsedVoiceEntry {
  title: string | null
  /** Autor tal como se lo escuchó, sin normalizar (p. ej. "Orwell", no "George Orwell"). */
  author: string | null
  status: ReadingStatus | null
  /** 1 a 5. `null` si no se mencionó ninguna puntuación explícita. */
  rating: number | null
  /** Texto de la reseña, con limpieza mínima de transcripción. `null` si no hubo. */
  review: string | null
  /** Progreso de lectura en % (0-100). `null` si no hay información suficiente para calcularlo. */
  progress: number | null
}

const WORD_NUMBERS: Record<string, number> = {
  uno: 1, una: 1, un: 1,
  dos: 2, tres: 3, cuatro: 4, cinco: 5,
}

function normalize(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

/** Divide el texto en oraciones por puntuación fuerte, preservando comas/y dentro de cada una. */
function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map(s => s.replace(/[.!?]+$/, '').trim())
    .filter(Boolean)
}

// Se evalúan en este orden porque "no pude terminar" / "dejé" contienen frases que
// también matchearían el patrón de "terminé" o de progreso si se buscaran sueltas.
const STATUS_PATTERNS: { status: ReadingStatus; re: RegExp }[] = [
  { status: 'abandoned', re: /\bno\s+pude\s+(?:terminar|con)\s+(.+)/i },
  { status: 'abandoned', re: /\b(?:dej[eé]|abandon[eé])\s+(.+)/i },
  { status: 'read', re: /\b(?:termin[eé]|acab[eé]\s+de\s+terminar|acabo\s+de\s+terminar)\s+(?:de\s+leer\s+)?(.+)/i },
  { status: 'reading', re: /\b(?:estoy\s+leyendo|ando\s+leyendo|voy\s+leyendo)\s+(.+)/i },
  { status: 'reading', re: /\b(?:empec[eé]|comenc[eé]|arranqu[eé])\s+(?:a\s+leer\s+)?(.+)/i },
  { status: 'pending', re: /\b(?:quiero\s+leer|tengo\s+pendiente|me\s+gustar[ií]a\s+leer|voy\s+a\s+leer)\s+(.+)/i },
]

// Corta el fragmento de título apenas aparece una cláusula de puntuación, progreso o motivo.
const TITLE_TERMINATORS = /\s+(?:y\s+le\s+(?:doy|pongo)|le\s+(?:doy|pongo)|porque|voy\s+(?:aproximadamente\s+|m[aá]s\s+o\s+menos\s+)?por).*$/i

function extractTitleAuthor(sentence: string): { status: ReadingStatus; title: string; author: string | null } | null {
  for (const { status, re } of STATUS_PATTERNS) {
    const m = sentence.match(re)
    if (!m) continue
    let raw = m[1].trim()
    raw = raw.split(',')[0].trim()
    raw = raw.replace(TITLE_TERMINATORS, '').trim()
    raw = raw.replace(/[,;:]+$/, '').trim()
    raw = raw.replace(/^de\s+/i, '').trim()
    if (!raw) continue

    // Heurística: sólo se separa el autor si, después del último " de ", queda algo con
    // pinta de nombre propio (palabras capitalizadas). "Cien años de soledad" no matchea
    // porque "soledad" no está capitalizada; "Rayuela de Julio Cortázar" sí.
    const authorMatch = raw.match(/^(.*?)\s+de\s+([A-ZÁÉÍÓÚÑ][\wÀ-ÿ'’.-]*(?:\s+[A-ZÁÉÍÓÚÑ][\wÀ-ÿ'’.-]*){0,3})$/)
    if (authorMatch && authorMatch[1].trim()) {
      return { status, title: authorMatch[1].trim(), author: authorMatch[2].trim() }
    }
    return { status, title: raw, author: null }
  }
  return null
}

function extractRating(text: string): number | null {
  const patterns = [
    /(\d)\s*estrellas?/i,
    /(\d)\s*(?:sobre|de)\s*5/i,
    /le\s+(?:doy|pongo)\s+(?:un|una)?\s*(uno|una|dos|tres|cuatro|cinco|\d)\b/i,
    /\b(uno|una|dos|tres|cuatro|cinco)\s+estrellas?/i,
  ]
  for (const re of patterns) {
    const m = text.match(re)
    if (!m) continue
    const raw = m[1].toLowerCase()
    const n = /^\d$/.test(raw) ? Number(raw) : WORD_NUMBERS[raw]
    if (n && n >= 1 && n <= 5) return n
  }
  return null
}

function isRatingOnlySentence(sentence: string): boolean {
  return /^(?:y\s+)?le\s+(?:doy|pongo)\b/i.test(sentence.trim())
}

function extractProgress(text: string): number | null {
  if (/voy\s+(?:aproximadamente\s+|más\s+o\s+menos\s+)?por\s+la\s+mitad/i.test(text)) return 50
  const pageOf = text.match(/p[aá]gina\s+(\d+)\s+de\s+(\d+)/i)
  if (pageOf) {
    const current = Number(pageOf[1])
    const total = Number(pageOf[2])
    if (total > 0) return Math.min(100, Math.round((current / total) * 100))
  }
  return null
}

/** Limpieza mínima de artefactos típicos de transcripción — no reescribe el contenido. */
function cleanupTranscribedText(text: string): string {
  let t = text.trim()
  t = t.replace(/\s+([,.!?])/g, '$1')
  t = t.charAt(0).toUpperCase() + t.slice(1)
  if (!/[.!?]$/.test(t)) t += '.'
  return t
}

export function parseVoiceEntry(rawText: string): ParsedVoiceEntry {
  const text = normalize(rawText)
  const result: ParsedVoiceEntry = {
    title: null, author: null, status: null, rating: null, review: null, progress: null,
  }
  if (!text) return result

  const sentences = splitSentences(text)
  let titleSentenceIndex = -1

  for (let i = 0; i < sentences.length; i++) {
    const match = extractTitleAuthor(sentences[i])
    if (match) {
      result.status = match.status
      result.title = match.title
      result.author = match.author
      titleSentenceIndex = i
      break
    }
  }

  result.rating = extractRating(text)
  result.progress = extractProgress(text)

  const reviewSentences = sentences.filter((s, i) => i !== titleSentenceIndex && !isRatingOnlySentence(s))
  const reviewText = reviewSentences.join('. ').trim()
  result.review = reviewText ? cleanupTranscribedText(reviewText) : null

  return result
}
