import { useEffect, useRef } from 'react'

const FOCUSABLE = [
  'a[href]', 'button:not([disabled])', 'textarea:not([disabled])',
  'input:not([disabled])', 'select:not([disabled])', '[tabindex]:not([tabindex="-1"])',
].join(',')

function isVisible(el: HTMLElement): boolean {
  // offsetParent es null tanto para elementos ocultos como en jsdom (que no
  // calcula layout) — se usa getComputedStyle, que sí funciona en jsdom.
  const style = window.getComputedStyle(el)
  return style.display !== 'none' && style.visibility !== 'hidden'
}

function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(isVisible)
}

/**
 * Comportamiento estándar de diálogo accesible (WAI-ARIA Dialog pattern):
 * foco atrapado dentro del modal mientras está abierto, Escape cierra,
 * y al desmontar el foco vuelve a quien lo abrió. Un solo hook para no
 * repetir esta lógica (y sus bugs) en cada modal de la app.
 *
 * `active=false` suelta el trap sin desmontar — para un modal que abre
 * un sub-overlay propio (ej. el escáner de ISBN dentro de BookModal) y
 * no quiere que ambos disputen el foco al mismo tiempo.
 */
export function useDialogA11y(onClose: () => void, active = true) {
  const containerRef = useRef<HTMLDivElement>(null)
  const hasFocusedRef = useRef(false)
  // Capturado en el render inicial (no en un efecto): un useEffect corre
  // DESPUÉS del commit, que es cuando React ya aplicó cualquier autoFocus
  // de un campo de adentro del diálogo — para entonces document.activeElement
  // ya sería ese campo, no el botón que abrió el diálogo.
  const triggerRef = useRef<Element | null>(typeof document !== 'undefined' ? document.activeElement : null)

  useEffect(() => {
    if (!active) return
    const container = containerRef.current

    if (!hasFocusedRef.current) {
      // Si algún campo ya se autoenfocó (prop autoFocus de React, que se
      // aplica antes de que corran los efectos) lo respetamos en vez de
      // pisarlo con el primer elemento enfocable del contenedor.
      const alreadyFocusedInside = container?.contains(document.activeElement) && document.activeElement !== document.body
      if (!alreadyFocusedInside) {
        const focusables = container ? getFocusable(container) : []
        ;(focusables[0] ?? container)?.focus()
      }
      hasFocusedRef.current = true
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      if (e.key !== 'Tab' || !container) return

      const items = getFocusable(container)
      if (items.length === 0) {
        e.preventDefault()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      const current = document.activeElement as HTMLElement | null

      if (e.shiftKey && (current === first || !container.contains(current))) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && (current === last || !container.contains(current))) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose, active])

  useEffect(() => () => {
    const trigger = triggerRef.current
    if (trigger instanceof HTMLElement && document.contains(trigger)) {
      trigger.focus()
    }
  }, [])

  return containerRef
}
