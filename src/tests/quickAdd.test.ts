import { describe, it, expect } from 'vitest'
import { planQuickAdd, quickAddMessage } from '../services/quickAdd'
import type { Book } from '../types'

const TODAY = '2026-10-22'
const SRC = { title: 'Pedro Páramo', author: 'Juan Rulfo', publisher: 'FCE', year: 1955, coverLarge: 'https://covers/x-L.jpg' }

function book(over: Partial<Book>): Book {
  return { id: 'b1', title: 'Pedro Páramo', author: 'Juan Rulfo', createdAt: '2026-01-01', notes: 'mi nota', score: 4, ...over } as Book
}

describe('planQuickAdd', () => {
  it('libro nuevo + Leído → crea con fechas de hoy (mismo criterio que el resto de la app)', () => {
    const plan = planQuickAdd([], SRC, 'read', TODAY)
    expect(plan.kind).toBe('create')
    if (plan.kind !== 'create') return
    expect(plan.data).toMatchObject({ title: 'Pedro Páramo', author: 'Juan Rulfo', publisher: 'FCE', year: 1955, cover: SRC.coverLarge, startDate: TODAY, endDate: TODAY, abandoned: false })
    expect(quickAddMessage(plan, 'read')).toBe('Guardado como Leído')
  })

  it('libro nuevo + Pendiente → crea sin fechas', () => {
    const plan = planQuickAdd([], SRC, 'pending', TODAY)
    expect(plan.kind === 'create' && plan.data).toMatchObject({ startDate: '', endDate: '', abandoned: false })
  })

  it('detecta el duplicado sin importar tildes ni mayúsculas', () => {
    const plan = planQuickAdd([book({ title: 'PEDRO PARAMO', author: 'juan rulfo' })], SRC, 'pending', TODAY)
    expect(plan.kind).toBe('noop')
  })

  it('existente pendiente + Leído → actualiza a leído conservando todos sus datos', () => {
    const existing = book({ startDate: '', endDate: '' })
    const plan = planQuickAdd([existing], SRC, 'read', TODAY)
    expect(plan.kind).toBe('update')
    if (plan.kind !== 'update') return
    // El libro completo (PUT reemplaza todas las columnas): nota y puntaje intactos
    expect(plan.data).toMatchObject({ id: 'b1', notes: 'mi nota', score: 4, startDate: TODAY, endDate: TODAY, abandoned: false })
    expect(quickAddMessage(plan, 'read')).toBe('Ya estaba en tu biblioteca: ahora figura como Leído')
  })

  it('existente en lectura + Leído → conserva la fecha de inicio', () => {
    const plan = planQuickAdd([book({ startDate: '2026-09-01' })], SRC, 'read', TODAY)
    expect(plan.kind === 'update' && plan.data).toMatchObject({ startDate: '2026-09-01', endDate: TODAY })
  })

  it('existente abandonado + Leído → deja de estar abandonado', () => {
    const plan = planQuickAdd([book({ startDate: '2026-03-01', abandoned: true })], SRC, 'read', TODAY)
    expect(plan.kind === 'update' && plan.data).toMatchObject({ abandoned: false, endDate: TODAY })
  })

  it('existente ya leído + Leído → no cambia nada', () => {
    const plan = planQuickAdd([book({ startDate: '2026-01-01', endDate: '2026-02-01' })], SRC, 'read', TODAY)
    expect(plan).toMatchObject({ kind: 'noop', status: 'read' })
    expect(quickAddMessage(plan, 'read')).toBe('Ya está en tu biblioteca como Leído')
  })

  it('existente leído o en lectura + Pendiente → no se degrada (no se pierden fechas)', () => {
    expect(planQuickAdd([book({ startDate: '2026-01-01', endDate: '2026-02-01' })], SRC, 'pending', TODAY))
      .toMatchObject({ kind: 'noop', status: 'read' })
    expect(planQuickAdd([book({ startDate: '2026-09-01' })], SRC, 'pending', TODAY))
      .toMatchObject({ kind: 'noop', status: 'reading' })
  })

  it('mismo título de otro autor → es otro libro', () => {
    const plan = planQuickAdd([book({ author: 'Otro Autor' })], SRC, 'read', TODAY)
    expect(plan.kind).toBe('create')
  })
})
