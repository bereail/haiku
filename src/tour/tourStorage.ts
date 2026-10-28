// Preferencia del tutorial, por persona y en este navegador. No se guarda el email:
// la clave lleva un hash corto (FNV-1a), así no queda a la vista después de cerrar sesión.

export type TourPreference = 'done' | 'dismissed'

const PREFIX = 'haiku_tour_v1:'
const POSTPONED = 'haiku_tour_postponed'

export function tourKey(email: string): string {
  let h = 0x811c9dc5
  for (const ch of email.trim().toLowerCase()) {
    h ^= ch.codePointAt(0)!
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return PREFIX + h.toString(16).padStart(8, '0')
}

export function getTourPreference(email: string): TourPreference | null {
  try {
    const v = localStorage.getItem(tourKey(email))
    return v === 'done' || v === 'dismissed' ? v : null
  } catch {
    return null
  }
}

export function setTourPreference(email: string, value: TourPreference) {
  try { localStorage.setItem(tourKey(email), value) } catch { /* almacenamiento bloqueado */ }
}

// "Más tarde": no vuelve a invitar en esta pestaña, sí en la próxima visita.
export function isTourPostponed(): boolean {
  try { return sessionStorage.getItem(POSTPONED) === '1' } catch { return false }
}

export function postponeTour() {
  try { sessionStorage.setItem(POSTPONED, '1') } catch { /* almacenamiento bloqueado */ }
}
