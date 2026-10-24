// Dónde va el globo de ayuda respecto del elemento señalado. Función pura: se prueba
// sin navegador. Prefiere abajo, si no entra va arriba y, si tampoco, al centro.

export interface Rect { top: number; left: number; width: number; height: number }
export interface Size { width: number; height: number }

export interface Placement {
  side: 'top' | 'bottom' | 'center'
  top: number
  left: number
  // Posición horizontal de la flecha dentro del globo (px desde su borde izquierdo)
  arrowLeft: number
}

export const GUTTER = 16   // margen mínimo con los bordes de la pantalla
export const GAP = 14      // distancia entre el elemento y el globo (lugar para la flecha)
const ARROW_INSET = 22     // la flecha no se pega a las esquinas redondeadas

export function computePlacement(target: Rect | null, bubble: Size, viewport: Size): Placement {
  const centered: Placement = {
    side: 'center',
    top: Math.max(GUTTER, (viewport.height - bubble.height) / 2),
    left: Math.max(GUTTER, (viewport.width - bubble.width) / 2),
    arrowLeft: 0,
  }
  if (!target) return centered

  const below = target.top + target.height + GAP
  const above = target.top - GAP - bubble.height
  let side: Placement['side']
  let top: number
  if (below + bubble.height <= viewport.height - GUTTER) { side = 'bottom'; top = below }
  else if (above >= GUTTER) { side = 'top'; top = above }
  else return centered

  const centerX = target.left + target.width / 2
  const maxLeft = Math.max(GUTTER, viewport.width - GUTTER - bubble.width)
  const left = Math.min(Math.max(centerX - bubble.width / 2, GUTTER), maxLeft)
  const arrowLeft = Math.min(Math.max(centerX - left, ARROW_INSET), Math.max(ARROW_INSET, bubble.width - ARROW_INSET))
  return { side, top, left, arrowLeft }
}
