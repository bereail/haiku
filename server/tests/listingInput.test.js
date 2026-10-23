const { validateListingInput } = require('../validation/listingInput')

const base = { kind: 'venta', condition: 'bueno', bookTitle: 'Rayuela', price: 15000 }
const ok = (b, o) => validateListingInput({ ...base, ...b }, o)
const err = (b, o) => { try { ok(b, o); return null } catch (e) { return e } }
const UUID = '11111111-2222-3333-4444-555555555555'

describe('validateListingInput', () => {
  it('venta válida: precio en pesos → centavos, textos recortados', () => {
    expect(ok({ price: '15000.5', bookTitle: '  Rayuela ' })).toMatchObject({ kind: 'venta', priceCents: 1500050, bookTitle: 'Rayuela', photoIds: [] })
  })

  it('venta sin precio o con precio inválido → 400', () => {
    expect(err({ price: '' }).message).toBe('Una venta necesita un precio')
    expect(err({ price: -1 }).status).toBe(400)
    expect(err({ price: 'abc' }).status).toBe(400)
    expect(err({ price: 1e9 }).status).toBe(400)
  })

  it('intercambio: sin precio; con precio → 400', () => {
    expect(ok({ kind: 'intercambio', price: undefined }).priceCents).toBeNull()
    expect(err({ kind: 'intercambio', price: 100 }).message).toBe('Un intercambio no lleva precio')
  })

  it('tipo, estado del libro y estado de publicación tienen que ser válidos', () => {
    expect(err({ kind: 'regalo' }).status).toBe(400)
    expect(err({ condition: 'roto' }).status).toBe(400)
    expect(err({}, { requireStatus: true }).message).toMatch(/Estado de publicación/)
    expect(ok({ status: 'pausada' }, { requireStatus: true }).status).toBe('pausada')
  })

  it('título obligatorio y topes de longitud', () => {
    expect(err({ bookTitle: ' ' }).message).toMatch(/obligatorio/)
    expect(err({ description: 'x'.repeat(2001) }).message).toMatch(/2000/)
    expect(err({ contact: 'x'.repeat(201) }).status).toBe(400)
    expect(err({ bookTitle: { $ne: '' } }).message).toMatch(/formato/)
  })

  it('fotos: hasta 4, ids válidos y sin repetir', () => {
    expect(ok({ photoIds: [UUID] }).photoIds).toEqual([UUID])
    expect(err({ photoIds: [UUID, UUID] }).message).toMatch(/repetidas/)
    expect(err({ photoIds: ['../../etc'] }).status).toBe(400)
    expect(err({ photoIds: Array.from({ length: 5 }, (_, i) => UUID.slice(0, -1) + i) }).message).toMatch(/hasta 4/)
    expect(err({ photoIds: 'x' }).status).toBe(400)
  })
})
