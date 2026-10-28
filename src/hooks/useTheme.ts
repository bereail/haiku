import { useState, useEffect } from 'react'

// Misma lógica que el script inline de index.html, que aplica el tema antes del
// primer cuadro (sin destello claro). Si se cambia una, cambiar la otra.
const KEY = 'haiku_theme'
const DARK_QUERY = '(prefers-color-scheme: dark)'

// Solo se guarda una elección EXPLÍCITA (el botón). Antes se guardaba también el
// valor tomado del sistema en la primera visita, y desde ahí la app ignoraba
// para siempre los cambios de tema del sistema.
function storedChoice(): 'dark' | 'light' | null {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'dark' || v === 'light' ? v : null
  } catch {
    return null
  }
}

function systemPrefersDark(): boolean {
  try {
    return window.matchMedia(DARK_QUERY).matches
  } catch {
    return false
  }
}

export function useTheme() {
  const [dark, setDark] = useState(() => {
    const stored = storedChoice()
    return stored ? stored === 'dark' : systemPrefersDark()
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
  }, [dark])

  // Sin elección explícita, seguir en vivo los cambios del sistema
  useEffect(() => {
    let mq: MediaQueryList
    try {
      mq = window.matchMedia(DARK_QUERY)
    } catch {
      return
    }
    const onChange = (e: MediaQueryListEvent) => {
      if (!storedChoice()) setDark(e.matches)
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const toggle = () => {
    const next = !dark
    try {
      localStorage.setItem(KEY, next ? 'dark' : 'light')
    } catch {
      // Sin almacenamiento (modo privado estricto): el cambio vale para esta sesión
    }
    setDark(next)
  }

  return { dark, toggle }
}
