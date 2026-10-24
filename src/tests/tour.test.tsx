import { useState } from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Tour, { TourInvite } from '../components/Tour'
import { computePlacement, GAP, GUTTER } from '../tour/placement'
import { findTarget, stepBody, stepsFor, TOUR_STEPS, type TourStep } from '../tour/tourSteps'
import { getTourPreference, isTourPostponed, postponeTour, setTourPreference, tourKey } from '../tour/tourStorage'

// jsdom no calcula layout: getClientRects siempre viene vacío. Se simula que un
// elemento está "visible" salvo que tenga el atributo hidden.
beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'getClientRects').mockImplementation(function (this: HTMLElement) {
    return (this.closest('[hidden]') ? [] : [{}]) as unknown as DOMRectList
  })
})
afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
  sessionStorage.clear()
})

describe('computePlacement', () => {
  const viewport = { width: 1000, height: 800 }
  const bubble = { width: 300, height: 200 }

  it('sin elemento, centra el globo', () => {
    expect(computePlacement(null, bubble, viewport)).toEqual({ side: 'center', top: 300, left: 350, arrowLeft: 0 })
  })

  it('prefiere abajo del elemento, con la flecha apuntando a su centro', () => {
    const p = computePlacement({ top: 10, left: 400, width: 100, height: 40 }, bubble, viewport)
    expect(p.side).toBe('bottom')
    expect(p.top).toBe(50 + GAP)
    expect(p.left + p.arrowLeft).toBe(450)
  })

  it('va arriba si abajo no entra', () => {
    const p = computePlacement({ top: 700, left: 400, width: 100, height: 40 }, bubble, viewport)
    expect(p.side).toBe('top')
    expect(p.top + bubble.height + GAP).toBe(700)
  })

  it('al centro si no entra ni arriba ni abajo (elemento enorme)', () => {
    expect(computePlacement({ top: 100, left: 0, width: 1000, height: 600 }, bubble, viewport).side).toBe('center')
  })

  it('no se sale de la pantalla en los bordes y la flecha queda dentro del globo', () => {
    const right = computePlacement({ top: 10, left: 960, width: 30, height: 30 }, bubble, viewport)
    expect(right.left + bubble.width).toBeLessThanOrEqual(viewport.width - GUTTER)
    expect(right.arrowLeft).toBeLessThan(bubble.width)
    const left = computePlacement({ top: 10, left: 0, width: 30, height: 30 }, bubble, viewport)
    expect(left.left).toBe(GUTTER)
    expect(left.arrowLeft).toBeGreaterThan(0)
  })

  it('en un celular angosto el globo ocupa el ancho disponible sin desbordar', () => {
    const p = computePlacement({ top: 10, left: 300, width: 40, height: 40 }, { width: 358, height: 250 }, { width: 390, height: 844 })
    expect(p.left).toBe(GUTTER)
  })
})

describe('preferencia del tutorial', () => {
  it('la clave no guarda el email y no distingue mayúsculas', () => {
    expect(tourKey('Ana@Test.dev')).toBe(tourKey('ana@test.dev '))
    expect(tourKey('ana@test.dev')).not.toContain('ana')
    expect(tourKey('ana@test.dev')).not.toBe(tourKey('beto@test.dev'))
  })

  it('se recuerda por persona', () => {
    expect(getTourPreference('ana@test.dev')).toBeNull()
    setTourPreference('ana@test.dev', 'done')
    expect(getTourPreference('ana@test.dev')).toBe('done')
    expect(getTourPreference('beto@test.dev')).toBeNull()
  })

  it('ignora valores desconocidos y no rompe si el almacenamiento está bloqueado', () => {
    localStorage.setItem(tourKey('ana@test.dev'), 'cualquiera')
    expect(getTourPreference('ana@test.dev')).toBeNull()
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('bloqueado') })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('bloqueado') })
    expect(getTourPreference('ana@test.dev')).toBeNull()
    expect(() => setTourPreference('ana@test.dev', 'done')).not.toThrow()
    expect(isTourPostponed()).toBe(false)
    expect(() => postponeTour()).not.toThrow()
  })

  it('«Más tarde» dura solo esta sesión del navegador', () => {
    expect(isTourPostponed()).toBe(false)
    postponeTour()
    expect(isTourPostponed()).toBe(true)
  })
})

describe('pasos', () => {
  it('el paso del Panel admin es solo para admin', () => {
    expect(stepsFor({ isAdmin: false }).some(s => s.id === 'admin')).toBe(false)
    expect(stepsFor({ isAdmin: true }).some(s => s.id === 'admin')).toBe(true)
  })

  it('todos los pasos con elemento usan nombres data-tour existentes en la interfaz', () => {
    // Si se renombra un data-tour en la UI hay que actualizar esta lista (y el paso).
    const known = new Set(['voice', 'search-books', 'add-book', 'library-empty', 'library-filters',
      'book-card', 'more-actions', 'admin', 'help'])
    for (const s of TOUR_STEPS) for (const t of s.targets ?? []) expect(known, `${s.id}: ${t}`).toContain(t)
  })

  it('findTarget saltea los elementos ocultos y usa el primero visible', () => {
    document.body.innerHTML = `
      <div data-tour="more-actions" hidden id="escritorio"></div>
      <div data-tour="more-actions" data-tour-variant="mobile" id="celular"></div>`
    const step = TOUR_STEPS.find(s => s.id === 'more')!
    const el = findTarget(step)
    expect(el?.id).toBe('celular')
    expect(stepBody(step, { variant: el!.dataset.tourVariant!, isDemo: false })).toMatch(/Más opciones/)
    document.body.innerHTML = ''
  })
})

// ── Componente ────────────────────────────────────────────────────────────────

const STEPS: TourStep[] = [
  { id: 'hola', title: 'Bienvenida', body: 'Hola.' },
  { id: 'buscar', title: 'Buscar', body: 'Buscá libros.', targets: ['search-books'], practice: true },
  { id: 'vacio', title: 'Vacía', body: 'No hay libros.', targets: ['library-empty'] },
  { id: 'fin', title: 'Fin', body: 'Listo.', targets: ['help'] },
]

// Una "app" mínima con elementos reales a los que apunta el recorrido: el botón de
// buscar abre un diálogo modal, como el de la aplicación.
function FakeApp({ onSearch }: { onSearch?: () => void }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button data-tour="search-books" onClick={() => { onSearch?.(); setOpen(true) }}>Buscar</button>
      <button data-tour="help">Ver tutorial</button>
      {open && (
        <div role="dialog" aria-modal="true" aria-label="Búsqueda">
          <button onClick={() => setOpen(false)}>Cerrar búsqueda</button>
        </div>
      )}
    </>
  )
}

function renderTour(opts: { isDemo?: boolean; onSearch?: () => void } = {}) {
  const onEnd = vi.fn()
  // Como en la app: la pantalla ya está montada cuando se abre el tutorial.
  const ui = (tour: boolean) => (
    <>
      <FakeApp onSearch={opts.onSearch} />
      {tour && <Tour steps={STEPS} isDemo={!!opts.isDemo} onEnd={onEnd} />}
    </>
  )
  const { rerender } = render(ui(false))
  rerender(ui(true))
  return { onEnd, user: userEvent.setup() }
}

const tourDialog = () => screen.getByRole('dialog', { name: /Bienvenida|Buscar|Fin|Vacía/ })

describe('<Tour>', () => {
  it('arranca en la bienvenida, con el progreso y el foco en el botón principal', () => {
    renderTour()
    const dlg = tourDialog()
    expect(dlg).toHaveAttribute('aria-modal', 'true')
    expect(within(dlg).getByRole('heading', { name: 'Bienvenida' })).toBeInTheDocument()
    // El paso de biblioteca vacía no tiene elemento en pantalla: no cuenta
    expect(within(dlg).getByText('Paso 1 de 3')).toBeInTheDocument()
    expect(within(dlg).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1')
    expect(within(dlg).getByRole('button', { name: 'Empezar' })).toHaveFocus()
    expect(within(dlg).queryByRole('button', { name: 'Anterior' })).toBeNull()
  })

  it('avanza y retrocede; saltea los pasos cuyo elemento no existe', async () => {
    const { user } = renderTour()
    await user.click(screen.getByRole('button', { name: 'Empezar' }))
    expect(within(tourDialog()).getByRole('heading', { name: 'Buscar' })).toBeInTheDocument()
    expect(screen.getByText('Paso 2 de 3')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Siguiente' }))
    expect(within(tourDialog()).getByRole('heading', { name: 'Fin' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Anterior' }))
    expect(within(tourDialog()).getByRole('heading', { name: 'Buscar' })).toBeInTheDocument()
  })

  it('se maneja con el teclado: flechas para moverse y Escape para salir', async () => {
    const { user, onEnd } = renderTour()
    await user.keyboard('{ArrowRight}')
    expect(within(tourDialog()).getByRole('heading', { name: 'Buscar' })).toBeInTheDocument()
    await user.keyboard('{ArrowLeft}')
    expect(within(tourDialog()).getByRole('heading', { name: 'Bienvenida' })).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(onEnd).toHaveBeenCalledWith('skipped')
  })

  it('«Omitir» y la cruz terminan como omitido; «Finalizar» como terminado', async () => {
    let r = renderTour()
    await r.user.click(screen.getByRole('button', { name: 'Omitir' }))
    expect(r.onEnd).toHaveBeenCalledWith('skipped')
    document.body.innerHTML = ''

    r = renderTour()
    await r.user.click(screen.getByRole('button', { name: 'Cerrar tutorial' }))
    expect(r.onEnd).toHaveBeenCalledWith('skipped')
    document.body.innerHTML = ''

    r = renderTour()
    await r.user.click(screen.getByRole('button', { name: 'Empezar' }))
    await r.user.click(screen.getByRole('button', { name: 'Siguiente' }))
    expect(screen.queryByRole('button', { name: 'Omitir' })).toBeNull()
    await r.user.click(screen.getByRole('button', { name: 'Finalizar' }))
    expect(r.onEnd).toHaveBeenCalledWith('finished')
  })

  it('modo práctica: «Probalo» usa el botón real, pausa y sigue al cerrar lo que se abrió', async () => {
    const onSearch = vi.fn()
    const { user } = renderTour({ onSearch })
    await user.click(screen.getByRole('button', { name: 'Empezar' }))
    await user.click(within(tourDialog()).getByRole('button', { name: 'Probalo' }))

    expect(onSearch).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('dialog', { name: 'Búsqueda' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: /Buscar/ })).toBeNull()
    expect(screen.getByRole('region', { name: 'Tutorial en pausa' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Cerrar búsqueda' }))
    expect(await screen.findByRole('heading', { name: 'Fin' })).toBeInTheDocument()
  })

  it('modo práctica con el mouse: tocar el botón resaltado también pausa', async () => {
    const onSearch = vi.fn()
    const { user } = renderTour({ onSearch })
    await user.click(screen.getByRole('button', { name: 'Empezar' }))
    await act(async () => { screen.getByRole('button', { name: 'Buscar' }).click() })
    expect(onSearch).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('region', { name: 'Tutorial en pausa' })).toBeInTheDocument()
  })

  it('en pausa se puede seguir o salir a mano, aunque no se haya abierto nada', async () => {
    const { user, onEnd } = renderTour()
    await user.click(screen.getByRole('button', { name: 'Empezar' }))
    await user.click(within(tourDialog()).getByRole('button', { name: 'Probalo' }))
    await user.click(screen.getByRole('button', { name: 'Cerrar búsqueda' }))
    // ya siguió solo; probamos la salida desde una nueva pausa
    await user.click(screen.getByRole('button', { name: 'Anterior' }))
    await user.click(within(tourDialog()).getByRole('button', { name: 'Probalo' }))
    await user.click(screen.getByRole('button', { name: 'Salir' }))
    expect(onEnd).toHaveBeenCalledWith('skipped')
  })

  it('la cuenta demo (solo lectura) no tiene modo práctica', () => {
    renderTour({ isDemo: true })
    act(() => { screen.getByRole('button', { name: 'Empezar' }).click() })
    expect(within(tourDialog()).queryByRole('button', { name: 'Probalo' })).toBeNull()
  })

  it('nunca acciona nada solo: recorrerlo entero no toca la aplicación', async () => {
    const onSearch = vi.fn()
    const { user } = renderTour({ onSearch })
    await user.click(screen.getByRole('button', { name: 'Empezar' }))
    await user.click(screen.getByRole('button', { name: 'Siguiente' }))
    await user.click(screen.getByRole('button', { name: 'Finalizar' }))
    expect(onSearch).not.toHaveBeenCalled()
  })

  it('si el elemento desaparece en medio del paso, el globo queda centrado y no se rompe', async () => {
    const { user } = renderTour()
    await user.click(screen.getByRole('button', { name: 'Empezar' }))
    screen.getByRole('button', { name: 'Buscar' }).setAttribute('hidden', '')
    await act(async () => { window.dispatchEvent(new Event('resize')); await new Promise(r => requestAnimationFrame(r)) })
    expect(tourDialog()).toBeInTheDocument()
    expect(within(tourDialog()).queryByRole('button', { name: 'Probalo' })).toBeNull()
  })
})

describe('<TourInvite>', () => {
  it('ofrece empezar, posponer o no volver a mostrar, sin llevarse el foco', async () => {
    const onStart = vi.fn(), onLater = vi.fn(), onDismiss = vi.fn()
    render(<TourInvite onStart={onStart} onLater={onLater} onDismiss={onDismiss} />)
    const region = screen.getByRole('region', { name: '¿Primera vez en Librook?' })
    expect(region).not.toContainElement(document.activeElement as HTMLElement)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Ver el tutorial' }))
    await user.click(screen.getByRole('button', { name: 'Más tarde' }))
    await user.click(screen.getByRole('button', { name: 'No, gracias' }))
    expect([onStart, onLater, onDismiss].map(f => f.mock.calls.length)).toEqual([1, 1, 1])
  })
})
