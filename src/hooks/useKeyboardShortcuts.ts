import { useEffect } from 'react'

export function useKeyboardShortcuts(shortcuts) {
  useEffect(() => {
    const handler = (e) => {
      const active = document.activeElement as HTMLElement | null
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(active?.tagName) || active?.isContentEditable) return
      // Con un diálogo modal abierto los atajos globales no aplican: si no, una
      // tecla suelta abría otro modal encima del actual.
      if (document.querySelector('[aria-modal="true"]')) return
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const match = shortcuts.find(s => s.key === e.key)
      if (match) {
        e.preventDefault()
        match.handler()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [shortcuts])
}
