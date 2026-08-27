// Envoltorio sobre la Web Speech API nativa del navegador (SpeechRecognition).
// Gratuita, sin claves ni backend: el reconocimiento ocurre en el navegador (o en el
// servicio del proveedor del navegador). No hay alternativa de pago involucrada porque
// no hace falta — ver README para la justificación de costos.
export type SpeechErrorKind = 'not-allowed' | 'no-speech' | 'no-support' | 'network' | 'aborted' | 'unknown'

export interface SpeechServiceCallbacks {
  onResult: (transcript: string, isFinal: boolean) => void
  onError: (kind: SpeechErrorKind) => void
  onEnd?: () => void
}

interface SpeechRecognitionLike extends EventTarget {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((event: unknown) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }
  return w.SpeechRecognition || w.webkitSpeechRecognition || null
}

export function isSpeechRecognitionSupported(): boolean {
  return getRecognitionCtor() !== null
}

function mapError(error: string): SpeechErrorKind {
  switch (error) {
    case 'not-allowed':
    case 'permission-denied':
      return 'not-allowed'
    case 'no-speech':
      return 'no-speech'
    case 'network':
      return 'network'
    case 'aborted':
      return 'aborted'
    default:
      return 'unknown'
  }
}

export class SpeechService {
  private recognition: SpeechRecognitionLike | null = null

  start(callbacks: SpeechServiceCallbacks): boolean {
    const Ctor = getRecognitionCtor()
    if (!Ctor) {
      callbacks.onError('no-support')
      return false
    }

    const recognition = new Ctor()
    recognition.lang = 'es-AR'
    recognition.continuous = false
    recognition.interimResults = true
    recognition.maxAlternatives = 1

    recognition.onresult = (event: unknown) => {
      const e = event as { results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }
      let finalTranscript = ''
      let interimTranscript = ''
      for (let i = 0; i < e.results.length; i++) {
        const result = e.results[i]
        if (result.isFinal) finalTranscript += result[0].transcript
        else interimTranscript += result[0].transcript
      }
      if (finalTranscript) callbacks.onResult(finalTranscript.trim(), true)
      else if (interimTranscript) callbacks.onResult(interimTranscript.trim(), false)
    }

    recognition.onerror = (event: { error: string }) => {
      callbacks.onError(mapError(event.error))
    }

    recognition.onend = () => {
      callbacks.onEnd?.()
    }

    this.recognition = recognition
    try {
      recognition.start()
      return true
    } catch {
      callbacks.onError('unknown')
      return false
    }
  }

  stop(): void {
    this.recognition?.stop()
  }

  abort(): void {
    this.recognition?.abort()
    this.recognition = null
  }
}
