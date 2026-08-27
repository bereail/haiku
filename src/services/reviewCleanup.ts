// "Mejorar redacción" de una reseña dictada por voz — deliberadamente conservador.
//
// Corrige SÓLO problemas mecánicos de transcripción (espacios, mayúsculas, puntuación
// repetida, muletillas de habla). Nunca reescribe frases, nunca agrega argumentos ni
// cambia el tono. No se usa ningún modelo de lenguaje: es una función pura y local,
// así no hay costo ni riesgo de que "mejorar" termine inventando contenido que la
// persona nunca dijo (ver regla "NO INVENTAR INFORMACIÓN" del producto).
const FILLER_WORDS = /\b(eh+|este+|o sea|bueno,?|digamos|tipo,?)\b/gi

export function improveReviewWording(text: string): string {
  let t = text.trim()
  if (!t) return t

  t = t.replace(FILLER_WORDS, ' ')
  t = t.replace(/\s+/g, ' ').trim()
  t = t.replace(/\s+([,.!?])/g, '$1')
  t = t.replace(/([,.!?])(?=\S)/g, '$1 ')
  t = t.replace(/([.!?]\s+)([a-záéíóúñ])/g, (_, sep, letter) => sep + letter.toUpperCase())
  t = t.charAt(0).toUpperCase() + t.slice(1)
  if (!/[.!?]$/.test(t)) t += '.'

  return t
}
