import { test, expect, type APIRequestContext, type Page } from '@playwright/test'
import { API_URL, E2E_ORIGIN, bearer, storageStatePath, type AccountName } from './accounts'

// API del marketplace contra Postgres real: fotos (JPEG real del navegador con EXIF/GPS
// agregado), publicaciones de venta/intercambio, permisos, visibilidad y limpieza.

test.describe.configure({ mode: 'serial' })
test.use({ storageState: storageStatePath('lectora1') })

const RUN = Date.now()
const created: { who: AccountName; id: string }[] = []

// JPEG real generado por el navegador + un segmento APP1 "Exif" con coordenadas GPS
async function realJpegWithGps(page: Page, width = 800, height = 600): Promise<Buffer> {
  const b64 = await page.evaluate(([w, h]) => {
    const c = document.createElement('canvas')
    c.width = w; c.height = h
    const ctx = c.getContext('2d')!
    ctx.fillStyle = '#2d4a3e'; ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = '#fff'; ctx.font = '48px serif'; ctx.fillText('Librook', 40, 120)
    return c.toDataURL('image/jpeg', 0.8).split(',')[1]
  }, [width, height])
  const jpg = Buffer.from(b64, 'base64')
  const payload = Buffer.from('Exif\0\0GPSLatitude -34.6037 GPSLongitude -58.3816', 'binary')
  const app1 = Buffer.alloc(4); app1[0] = 0xff; app1[1] = 0xe1; app1.writeUInt16BE(payload.length + 2, 2)
  return Buffer.concat([jpg.subarray(0, 2), app1, payload, jpg.subarray(2)])
}

async function upload(request: APIRequestContext, who: AccountName, buf: Buffer) {
  const res = await request.post(`${API_URL}/uploads`, { headers: { ...bearer(who), 'Content-Type': 'image/jpeg' }, data: buf })
  expect(res.status(), await res.text()).toBe(201)
  return res.json() as Promise<{ id: string; url: string; width: number; height: number }>
}

const photoUrl = (u: string) => `${E2E_ORIGIN}${u}`

test.afterAll(async ({ request }) => {
  for (const c of created) {
    if (c.id) await request.delete(`${API_URL}/marketplace/listings/${c.id}`, { headers: bearer(c.who) })
  }
})

let saleId: string
let photos: { id: string; url: string }[] = []

test('sin sesión no se puede mirar ni publicar; la demo no puede publicar', async ({ request }) => {
  expect((await request.get(`${API_URL}/marketplace/listings`)).status()).toBe(401)
  expect((await request.post(`${API_URL}/marketplace/listings`, { data: {} })).status()).toBe(401)
  const demo = await request.post(`${API_URL}/marketplace/listings`, { headers: bearer('demo'), data: { kind: 'intercambio', condition: 'bueno', bookTitle: 'x' } })
  expect(demo.status()).toBe(403)
})

test('subir fotos reales: se quita el EXIF/GPS y la imagen servida se decodifica', async ({ page, request }) => {
  await page.goto('')
  const jpg = await realJpegWithGps(page)
  expect(jpg.toString('binary')).toContain('GPSLatitude')
  photos = [await upload(request, 'lectora1', jpg), await upload(request, 'lectora1', await realJpegWithGps(page, 640, 480))]
  expect(photos[0]).toMatchObject({ width: 800, height: 600 })

  const served = await request.get(photoUrl(photos[0].url))
  expect(served.status()).toBe(200)
  expect(served.headers()['content-type']).toBe('image/jpeg')
  expect(served.headers()['x-content-type-options']).toBe('nosniff')
  expect((await served.body()).toString('binary')).not.toMatch(/GPSLatitude|Exif/)

  // El navegador la decodifica (no quedó corrupta al quitar el segmento)
  const natural = await page.evaluate(async (src) => {
    const img = new Image(); img.src = src
    await img.decode()
    return [img.naturalWidth, img.naturalHeight]
  }, photoUrl(photos[0].url))
  expect(natural).toEqual([800, 600])
})

test('validaciones: venta sin precio, intercambio con precio, tipo inválido', async ({ request }) => {
  const h = bearer('lectora1')
  for (const data of [
    { kind: 'venta', condition: 'bueno', bookTitle: 'x' },
    { kind: 'intercambio', condition: 'bueno', bookTitle: 'x', price: 10 },
    { kind: 'regalo', condition: 'bueno', bookTitle: 'x' },
  ]) {
    const res = await request.post(`${API_URL}/marketplace/listings`, { headers: h, data })
    expect(res.status()).toBe(400)
  }
})

test('crear una venta con fotos; la ven otras personas con alias y sin datos privados', async ({ request }) => {
  const res = await request.post(`${API_URL}/marketplace/listings`, {
    headers: bearer('lectora1'),
    data: { kind: 'venta', condition: 'muy_bueno', bookTitle: `Rayuela ${RUN}`, bookAuthor: 'Julio Cortázar', price: 15000, city: 'CABA', contact: 'Por mensaje', photoIds: photos.map(p => p.id) },
  })
  expect(res.status()).toBe(201)
  const listing = await res.json()
  saleId = listing.id
  created.push({ who: 'lectora1', id: saleId })
  expect(listing).toMatchObject({ kind: 'venta', price: 15000, status: 'activa', isMine: true })
  expect(listing.photos.map((p: { id: string }) => p.id)).toEqual(photos.map(p => p.id))

  const seen = await request.get(`${API_URL}/marketplace/listings/${saleId}`, { headers: bearer('lectora2') })
  expect(seen.ok()).toBeTruthy()
  const body = await seen.text()
  expect(JSON.parse(body)).toMatchObject({ isMine: false, canDelete: false, sellerAlias: expect.stringMatching(/^Lector\/a [0-9A-F]{4}$/) })
  expect(body).not.toMatch(/@test\.dev|user_id|"email"/)
})

test('fotos ajenas o ya usadas no se pueden asociar (y no se crea nada a medias)', async ({ page, request }) => {
  await page.goto('')
  const foreign = await upload(request, 'lectora2', await realJpegWithGps(page))
  const before = (await (await request.get(`${API_URL}/marketplace/listings?mine=1`, { headers: bearer('lectora1') })).json()).listings.length
  for (const photoIds of [[foreign.id], [photos[0].id]]) {
    const res = await request.post(`${API_URL}/marketplace/listings`, {
      headers: bearer('lectora1'), data: { kind: 'intercambio', condition: 'bueno', bookTitle: `Intento ${RUN}`, photoIds },
    })
    expect(res.status()).toBe(400)
    expect((await res.json()).error).toMatch(/no es tuya o ya está en otra publicación/)
  }
  const after = (await (await request.get(`${API_URL}/marketplace/listings?mine=1`, { headers: bearer('lectora1') })).json()).listings.length
  expect(after).toBe(before) // la transacción se deshizo
  await request.delete(`${API_URL}/uploads/${foreign.id}`, { headers: bearer('lectora2') })
})

test('solo la dueña edita; sacar una foto la borra; pausar la oculta a los demás', async ({ request }) => {
  const other = await request.put(`${API_URL}/marketplace/listings/${saleId}`, {
    headers: bearer('lectora2'), data: { kind: 'venta', condition: 'bueno', bookTitle: 'Pisada', price: 1, status: 'activa' },
  })
  expect(other.status()).toBe(404)

  const upd = await request.put(`${API_URL}/marketplace/listings/${saleId}`, {
    headers: bearer('lectora1'),
    data: { kind: 'venta', condition: 'muy_bueno', bookTitle: `Rayuela ${RUN}`, price: 12000, status: 'pausada', photoIds: [photos[1].id] },
  })
  expect(upd.ok()).toBeTruthy()
  expect((await upd.json()).photos.map((p: { id: string }) => p.id)).toEqual([photos[1].id])
  expect((await request.get(photoUrl(photos[0].url))).status()).toBe(404) // registro y archivo borrados

  expect((await request.get(`${API_URL}/marketplace/listings/${saleId}`, { headers: bearer('lectora2') })).status()).toBe(404)
  const list = await (await request.get(`${API_URL}/marketplace/listings?q=${RUN}`, { headers: bearer('lectora2') })).json()
  expect(list.listings).toHaveLength(0)
  const mine = await (await request.get(`${API_URL}/marketplace/listings?mine=1`, { headers: bearer('lectora1') })).json()
  expect(mine.listings.some((l: { id: string; status: string }) => l.id === saleId && l.status === 'pausada')).toBe(true)
})

test('filtros: tipo y búsqueda por título/autor', async ({ request }) => {
  const ex = await request.post(`${API_URL}/marketplace/listings`, {
    headers: bearer('lectora2'), data: { kind: 'intercambio', condition: 'bueno', bookTitle: `Ficciones ${RUN}`, bookAuthor: 'Borges' },
  })
  const exId = (await ex.json()).id
  created.push({ who: 'lectora2', id: exId })
  const h = bearer('lectora1')
  const byKind = await (await request.get(`${API_URL}/marketplace/listings?kind=intercambio&q=${RUN}`, { headers: h })).json()
  expect(byKind.listings.map((l: { id: string }) => l.id)).toEqual([exId])
  const byAuthor = await (await request.get(`${API_URL}/marketplace/listings?q=borges`, { headers: h })).json()
  expect(byAuthor.listings.some((l: { id: string }) => l.id === exId)).toBe(true)
})

test('borrar: otra usuaria no puede; la admin sí; la dueña borra y se van sus fotos', async ({ request }) => {
  expect((await request.delete(`${API_URL}/marketplace/listings/${saleId}`, { headers: bearer('lectora2') })).status()).toBe(404)

  const victim = await request.post(`${API_URL}/marketplace/listings`, {
    headers: bearer('lectora2'), data: { kind: 'intercambio', condition: 'aceptable', bookTitle: `Moderar ${RUN}` },
  })
  const victimId = (await victim.json()).id
  expect((await request.delete(`${API_URL}/marketplace/listings/${victimId}`, { headers: bearer('admin') })).ok()).toBeTruthy()

  expect((await request.delete(`${API_URL}/marketplace/listings/${saleId}`, { headers: bearer('lectora1') })).ok()).toBeTruthy()
  expect((await request.get(photoUrl(photos[1].url))).status()).toBe(404)
  expect((await request.get(`${API_URL}/marketplace/listings/no-es-un-uuid`, { headers: bearer('lectora1') })).status()).toBe(404)
})
