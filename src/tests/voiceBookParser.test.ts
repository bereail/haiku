import { describe, it, expect } from 'vitest'
import { parseVoiceEntry } from '../services/voiceBookParser'

describe('parseVoiceEntry', () => {
  it('extrae título, autor, estado, puntaje y reseña de un relato completo', () => {
    const r = parseVoiceEntry(
      'Terminé El extranjero de Albert Camus. Le doy cuatro estrellas. ' +
      'Me gustó mucho cómo trata el absurdo, aunque el protagonista me resultó bastante frío.'
    )
    expect(r.title).toBe('El extranjero')
    expect(r.author).toBe('Albert Camus')
    expect(r.status).toBe('read')
    expect(r.rating).toBe(4)
    expect(r.review).toBe('Me gustó mucho cómo trata el absurdo, aunque el protagonista me resultó bastante frío.')
  })

  it('extrae título, autor y puntaje cuando todo está en una sola oración', () => {
    const r = parseVoiceEntry('Terminé Rayuela de Julio Cortázar y le doy cinco estrellas.')
    expect(r.title).toBe('Rayuela')
    expect(r.author).toBe('Julio Cortázar')
    expect(r.status).toBe('read')
    expect(r.rating).toBe(5)
    expect(r.review).toBeNull()
  })

  it('no inventa el puntaje cuando no se menciona explícitamente', () => {
    const r = parseVoiceEntry('Acabo de terminar Dune. Me gustó muchísimo, especialmente la construcción del mundo.')
    expect(r.title).toBe('Dune')
    expect(r.status).toBe('read')
    expect(r.rating).toBeNull()
    expect(r.review).toBe('Me gustó muchísimo, especialmente la construcción del mundo.')
  })

  it('detecta "leyendo" con progreso aproximado de la mitad', () => {
    const r = parseVoiceEntry('Estoy leyendo 1984 de Orwell, voy aproximadamente por la mitad.')
    expect(r.title).toBe('1984')
    expect(r.author).toBe('Orwell')
    expect(r.status).toBe('reading')
    expect(r.progress).toBe(50)
    expect(r.rating).toBeNull()
  })

  it('detecta progreso a partir de "página X de Y"', () => {
    const r = parseVoiceEntry('Estoy leyendo Dune de Frank Herbert, voy por la página 150 de 300.')
    expect(r.title).toBe('Dune')
    expect(r.author).toBe('Frank Herbert')
    expect(r.progress).toBe(50)
  })

  it('detecta "empecé" como leyendo, sin inventar progreso ni autor', () => {
    const r = parseVoiceEntry('Empecé El nombre del viento.')
    expect(r.title).toBe('El nombre del viento')
    expect(r.status).toBe('reading')
    expect(r.author).toBeNull()
    expect(r.progress).toBeNull()
  })

  it('detecta "no pude terminar" como abandonado', () => {
    const r = parseVoiceEntry('No pude terminar Cien años de soledad.')
    expect(r.title).toBe('Cien años de soledad')
    expect(r.status).toBe('abandoned')
    expect(r.author).toBeNull()
  })

  it('detecta "dejé" como abandonado', () => {
    const r = parseVoiceEntry('Dejé Cien años de soledad porque no me enganchó.')
    expect(r.status).toBe('abandoned')
    expect(r.title).toBe('Cien años de soledad')
  })

  it('detecta intención de "quiero leer" como pendiente', () => {
    const r = parseVoiceEntry('Quiero leer Crónica de una muerte anunciada.')
    expect(r.title).toBe('Crónica de una muerte anunciada')
    expect(r.status).toBe('pending')
    expect(r.author).toBeNull()
  })

  it('reconoce distintas formas de decir el puntaje', () => {
    expect(parseVoiceEntry('Terminé Beloved. Le doy un tres.').rating).toBe(3)
    expect(parseVoiceEntry('Terminé Beloved. Le pongo 4 sobre 5.').rating).toBe(4)
    expect(parseVoiceEntry('Terminé Beloved. Dos estrellas.').rating).toBe(2)
  })

  it('no reconoce título/estado/puntaje/progreso en texto sin información de lectura', () => {
    const r = parseVoiceEntry('Hola, cómo estás.')
    expect(r.title).toBeNull()
    expect(r.status).toBeNull()
    expect(r.rating).toBeNull()
    expect(r.progress).toBeNull()
  })

  it('ignora texto vacío sin lanzar errores', () => {
    const r = parseVoiceEntry('   ')
    expect(r.title).toBeNull()
  })
})
