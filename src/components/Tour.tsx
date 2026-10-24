import { Component, useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { useDialogA11y } from '../hooks/useDialogA11y'
import { computePlacement, type Placement, type Rect } from '../tour/placement'
import { findTarget, stepBody, type TourStep } from '../tour/tourSteps'
import styles from './Tour.module.css'

// Recorrido guiado sobre la interfaz real. Solo señala y explica: nunca acciona nada
// por su cuenta. En los pasos prácticos la persona toca el botón real (o «Probalo»),
// el recorrido se pausa mientras usa lo que abrió y sigue cuando lo cierra.

export type TourEnd = 'finished' | 'skipped'

interface Props {
  steps: TourStep[]
  isDemo: boolean
  onEnd: (how: TourEnd) => void
}

const PAD = 6 // aire alrededor del elemento resaltado

function prefersReducedMotion() {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function isAvailable(step: TourStep) {
  return !step.targets || findTarget(step) !== null
}

function toRect(el: HTMLElement | null): Rect | null {
  if (!el) return null
  const r = el.getBoundingClientRect()
  if (r.width === 0 && r.height === 0) return null
  return { top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 }
}

export default function Tour(props: Props) {
  // Un error del tutorial no puede tirar abajo la biblioteca: se cierra y listo.
  return (
    <TourBoundary onError={() => props.onEnd('skipped')}>
      <TourRunner {...props} />
    </TourBoundary>
  )
}

class TourBoundary extends Component<{ children: ReactNode; onError: () => void }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch() { this.props.onError() }
  render() { return this.state.failed ? null : this.props.children }
}

function TourRunner({ steps, isDemo, onEnd }: Props) {
  const [index, setIndex] = useState(() => Math.max(0, steps.findIndex(isAvailable)))
  const [phase, setPhase] = useState<'step' | 'waiting'>('step')
  const clickAfterPause = useRef<HTMLElement | null>(null)
  const step = steps[index]

  const nextIndex = useCallback((from: number) => {
    for (let j = from + 1; j < steps.length; j++) if (isAvailable(steps[j])) return j
    return -1
  }, [steps])

  const prevIndex = useCallback((from: number) => {
    for (let j = from - 1; j >= 0; j--) if (isAvailable(steps[j])) return j
    return -1
  }, [steps])

  const goNext = useCallback(() => {
    const j = nextIndex(index)
    if (j === -1) onEnd('finished')
    else { setIndex(j); setPhase('step') }
  }, [index, nextIndex, onEnd])

  const goPrev = useCallback(() => {
    const j = prevIndex(index)
    if (j !== -1) setIndex(j)
  }, [index, prevIndex])

  const pause = useCallback((clickTarget: HTMLElement | null) => {
    clickAfterPause.current = clickTarget
    setPhase('waiting')
  }, [])

  // En pausa: el clic pendiente («Probalo») se hace recién acá, después de que el globo
  // se desmontó y devolvió el foco, para que el diálogo que se abra lo tome bien. Se
  // sigue solo cuando se cerró el diálogo que se abrió; si no se abrió ninguno, la
  // persona sigue con el botón de la barra de pausa.
  useEffect(() => {
    if (phase !== 'waiting') return
    const el = clickAfterPause.current
    clickAfterPause.current = null
    if (el && document.contains(el)) { el.focus(); el.click() }

    let sawDialog = !!document.querySelector('[aria-modal="true"]')
    const check = () => {
      const open = !!document.querySelector('[aria-modal="true"]')
      if (open) sawDialog = true
      else if (sawDialog) { observer.disconnect(); goNext() }
    }
    const observer = new MutationObserver(check)
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-modal'] })
    return () => observer.disconnect()
  }, [phase, goNext])

  if (!step) return null

  if (phase === 'waiting') {
    return (
      <div className={styles.pausedBar} role="region" aria-label="Tutorial en pausa">
        <span>Tutorial en pausa</span>
        <button type="button" className={styles.primaryBtn} onClick={goNext}>Seguir el tutorial</button>
        <button type="button" className={styles.textBtn} onClick={() => onEnd('skipped')}>Salir</button>
      </div>
    )
  }

  const available = steps.filter((s, i) => i === index || isAvailable(s))
  return (
    <TourStepView
      key={step.id}
      step={step}
      position={available.indexOf(step) + 1}
      total={available.length}
      isDemo={isDemo}
      hasPrev={prevIndex(index) !== -1}
      isLast={nextIndex(index) === -1}
      onNext={goNext}
      onPrev={goPrev}
      onSkip={() => onEnd('skipped')}
      onPractice={pause}
    />
  )
}

interface StepViewProps {
  step: TourStep
  position: number
  total: number
  isDemo: boolean
  hasPrev: boolean
  isLast: boolean
  onNext: () => void
  onPrev: () => void
  onSkip: () => void
  onPractice: (clickTarget: HTMLElement | null) => void
}

function TourStepView({ step, position, total, isDemo, hasPrev, isLast, onNext, onPrev, onSkip, onPractice }: StepViewProps) {
  const [target, setTarget] = useState<HTMLElement | null>(() => findTarget(step))
  const [rect, setRect] = useState<Rect | null>(() => toRect(target))
  const [placement, setPlacement] = useState<Placement | null>(null)
  const containerRef = useDialogA11y(onSkip)
  const primaryRef = useRef<HTMLButtonElement>(null)
  const canPractice = !!step.practice && !isDemo && !!target

  // El elemento señalado puede cambiar (paso de escritorio a celular, re-render) o
  // moverse (scroll, cambio de tamaño): se vuelve a buscar y medir en cada caso.
  useEffect(() => {
    let frame = 0
    const update = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const el = findTarget(step)
        setTarget(el)
        setRect(toRect(el))
      })
    }
    const first = findTarget(step)
    if (first) {
      const r = first.getBoundingClientRect()
      if (r.top < 0 || r.bottom > window.innerHeight) {
        first.scrollIntoView({ block: 'center', behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
      }
    }
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(update) : null
    ro?.observe(document.body)
    if (first) ro?.observe(first)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
      ro?.disconnect()
    }
  }, [step])

  // Globo: se mide antes de pintar para ubicarlo sin saltos.
  useLayoutEffect(() => {
    const bubble = containerRef.current
    if (!bubble) return
    const next = computePlacement(
      rect,
      { width: bubble.offsetWidth, height: bubble.offsetHeight },
      { width: window.innerWidth, height: window.innerHeight },
    )
    setPlacement(prev => prev && prev.side === next.side && prev.top === next.top &&
      prev.left === next.left && prev.arrowLeft === next.arrowLeft ? prev : next)
  }, [rect, containerRef])

  // Foco en el botón principal recién cuando el globo está ubicado: mientras se mide
  // tiene visibility:hidden y el navegador ignora el focus().
  const focusedOnce = useRef(false)
  useEffect(() => {
    if (!placement || focusedOnce.current) return
    focusedOnce.current = true
    primaryRef.current?.focus()
  }, [placement])

  // Paso práctico con el mouse: tocar el botón real resaltado.
  useEffect(() => {
    if (!canPractice || !target) return
    const onClick = () => onPractice(null)
    target.addEventListener('click', onClick)
    return () => target.removeEventListener('click', onClick)
  }, [canPractice, target, onPractice])

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); onNext() }
    else if (e.key === 'ArrowLeft' && hasPrev) { e.preventDefault(); onPrev() }
  }

  const titleId = `tour-title-${step.id}`
  const bodyId = `tour-body-${step.id}`
  const body = stepBody(step, { variant: target?.dataset.tourVariant ?? null, isDemo })
  const side = placement?.side ?? 'center'

  return (
    <div className={styles.root} data-testid="tour">
      <div
        className={styles.backdrop}
        style={rect ? { clipPath: holePath(rect) } : undefined}
        aria-hidden="true"
      />
      {rect && (
        <>
          <div className={styles.ring} style={rectStyle(rect)} aria-hidden="true" data-testid="tour-highlight" />
          {/* Sin práctica, el hueco no deja tocar el elemento: el paso solo explica. */}
          {!canPractice && <div className={styles.blocker} style={rectStyle(rect)} aria-hidden="true" />}
        </>
      )}

      <div
        ref={containerRef}
        className={`${styles.bubble} ${styles[side]}`}
        style={{
          top: placement?.top ?? 0,
          left: placement?.left ?? 0,
          visibility: placement ? 'visible' : 'hidden',
          ['--arrow-left' as string]: `${placement?.arrowLeft ?? 0}px`,
        } as React.CSSProperties}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        onKeyDown={onKeyDown}
      >
        <div className={styles.header}>
          <p className={styles.progressText}>Paso {position} de {total}</p>
          <button type="button" className={styles.closeBtn} onClick={onSkip} aria-label="Cerrar tutorial">
            <svg width="14" height="14" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <path d="M2 2l14 14M16 2L2 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div
          className={styles.progressBar}
          role="progressbar"
          aria-label="Progreso del tutorial"
          aria-valuemin={1}
          aria-valuemax={total}
          aria-valuenow={position}
          aria-valuetext={`Paso ${position} de ${total}`}
        >
          <span style={{ width: `${(position / total) * 100}%` }} />
        </div>

        <h2 id={titleId} className={styles.title}>{step.title}</h2>
        <p id={bodyId} className={styles.body}>{body}</p>
        {canPractice && (
          <div className={styles.practice}>
            <p>Probalo vos: tocá el botón resaltado. El tutorial sigue cuando cierres lo que se abra.</p>
            <button type="button" className={styles.secondaryBtn} onClick={() => onPractice(target)}>Probalo</button>
          </div>
        )}
        {/* Anuncia el cambio de paso a lectores de pantalla (el foco queda en «Siguiente»). */}
        <p className={styles.srOnly} aria-live="polite">Paso {position} de {total}: {step.title}</p>

        <div className={styles.actions}>
          {!isLast && (
            <button type="button" className={styles.textBtn} onClick={onSkip}>Omitir</button>
          )}
          <span className={styles.spacer} />
          {hasPrev && (
            <button type="button" className={styles.secondaryBtn} onClick={onPrev}>Anterior</button>
          )}
          <button ref={primaryRef} type="button" className={styles.primaryBtn} onClick={onNext}>
            {isLast ? 'Finalizar' : position === 1 ? 'Empezar' : 'Siguiente'}
          </button>
        </div>
      </div>
    </div>
  )
}

function rectStyle(r: Rect): React.CSSProperties {
  return { top: r.top, left: r.left, width: r.width, height: r.height }
}

// Capa oscura con un hueco rectangular (regla evenodd) donde está el elemento señalado.
// clip-path también recorta la zona que recibe clics.
function holePath(r: Rect) {
  const W = 100000
  return `path(evenodd, 'M-${W} -${W}H${W}V${W}H-${W}Z M${r.left} ${r.top}h${r.width}v${r.height}h-${r.width}Z')`
}

interface InviteProps {
  onStart: () => void
  onLater: () => void
  onDismiss: () => void
}

// Invitación para quien entra por primera vez: no tapa la app ni se lleva el foco.
export function TourInvite({ onStart, onLater, onDismiss }: InviteProps) {
  return (
    <section className={styles.invite} aria-labelledby="tour-invite-title">
      <h2 id="tour-invite-title" className={styles.inviteTitle}>¿Primera vez en Librook?</h2>
      <p className={styles.inviteBody}>Te muestro cómo usarla en menos de un minuto, sobre la pantalla real.</p>
      <div className={styles.inviteActions}>
        <button type="button" className={styles.primaryBtn} onClick={onStart}>Ver el tutorial</button>
        <button type="button" className={styles.secondaryBtn} onClick={onLater}>Más tarde</button>
        <button type="button" className={styles.textBtn} onClick={onDismiss}>No, gracias</button>
      </div>
    </section>
  )
}
