// Pasos del recorrido. Cada `target` es el valor de un atributo data-tour="…" de la
// interfaz real; si ninguno está visible (permiso, pantalla chica, biblioteca vacía),
// el paso se saltea. `variant` sale del data-tour-variant del elemento encontrado.

export interface StepContext {
  variant: string | null
  isDemo: boolean
}

export interface TourStep {
  id: string
  title: string
  body: string | ((ctx: StepContext) => string)
  // Sin targets: globo centrado (bienvenida). Con varios: se usa el primero visible.
  targets?: string[]
  // Paso práctico: la persona puede tocar el elemento real y el recorrido sigue al
  // cerrar lo que se abrió. Nunca se acciona solo.
  practice?: boolean
  adminOnly?: boolean
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    title: 'Te damos la bienvenida a Librook',
    body: ({ isDemo }) =>
      'Librook es tu biblioteca personal: anotás lo que leíste, lo que estás leyendo y lo que querés leer. ' +
      'Te muestro lo principal en menos de un minuto.' +
      (isDemo ? ' Estás en la biblioteca de ejemplo: podés mirar todo, pero no se guardan cambios.' : ''),
  },
  {
    id: 'voice',
    title: 'Contame qué leíste',
    targets: ['voice'],
    practice: true,
    body: 'La forma más rápida de sumar un libro: tocá este botón y decí, por ejemplo, ' +
      '«Terminé Rayuela de Cortázar». Antes de guardar te muestra lo que entendió para que lo confirmes. ' +
      'Necesita permiso para usar el micrófono.',
  },
  {
    id: 'search',
    title: 'Buscá cualquier libro',
    targets: ['search-books'],
    practice: true,
    body: 'Escribí un título o un autor y elegí entre los resultados. ' +
      'Con «Leído» o «Pendiente» el libro queda guardado en tu biblioteca con un solo toque.',
  },
  {
    id: 'add',
    title: 'O cargalo a mano',
    targets: ['add-book'],
    practice: true,
    body: 'Completás la ficha vos: título, autor, fechas, puntaje y notas. ' +
      'Desde ahí también podés escanear el código de barras (ISBN) o sacarle una foto a la tapa.',
  },
  {
    id: 'empty',
    title: 'Tu biblioteca, todavía vacía',
    targets: ['library-empty'],
    body: 'Cuando agregues tu primer libro va a aparecer acá como una tarjeta. ' +
      'Estos botones hacen lo mismo que los de arriba.',
  },
  {
    id: 'filters',
    title: 'Encontrá tus libros',
    targets: ['library-filters'],
    body: 'Filtrá por Leyendo, Leídos, Pendientes, Abandonados o Favoritos. ' +
      'Justo arriba podés buscar entre tus libros por título o autor, y ordenarlos.',
  },
  {
    id: 'card',
    title: 'Cada libro es una tarjeta',
    targets: ['book-card'],
    body: 'Tocala una vez y se da vuelta: ves tus notas y los botones Editar y Eliminar. ' +
      'Tocala de nuevo y se abre la ficha completa, donde podés marcarlo como leído o compartir tu anotación en la Comunidad.',
  },
  {
    id: 'more',
    title: 'Todo lo demás',
    targets: ['more-actions'],
    body: ({ variant }) => variant === 'mobile'
      ? 'En «Más opciones» (los tres puntos) están Descubrir, tus Estadísticas y la meta del año, ' +
        'la Comunidad, el Mercado de libros para vender o intercambiar, Exportar y Cerrar sesión.'
      : 'Estos íconos abren Descubrir, tus Estadísticas y la meta del año, la Comunidad, el Mercado ' +
        'de libros para vender o intercambiar, el Catálogo público, Exportar y Cerrar sesión. Pasá el mouse por encima para ver el nombre de cada uno.',
  },
  {
    id: 'admin',
    title: 'Panel admin',
    targets: ['admin'],
    adminOnly: true,
    body: 'Solo lo ves vos: visitas a la aplicación y la lista de usuarios.',
  },
  {
    id: 'finish',
    title: '¡Listo!',
    targets: ['help', 'more-actions'],
    body: ({ variant }) => 'Ya sabés lo básico. ' + (variant === 'mobile'
      ? 'Si querés repetir el recorrido, está en «Más opciones» → «Ver tutorial».'
      : 'Si querés repetir el recorrido, tocá este botón: «Ver tutorial».'),
  },
]

export function stepsFor(role: { isAdmin: boolean }): TourStep[] {
  return TOUR_STEPS.filter(s => !s.adminOnly || role.isAdmin)
}

export function stepBody(step: TourStep, ctx: StepContext): string {
  return typeof step.body === 'function' ? step.body(ctx) : step.body
}

// Primer elemento visible para el paso (los ocultos con display:none o fuera del
// layout tienen getClientRects vacío).
export function findTarget(step: TourStep, root: ParentNode = document): HTMLElement | null {
  for (const name of step.targets ?? []) {
    const els = root.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`)
    for (const el of els) if (el.getClientRects().length > 0) return el
  }
  return null
}
