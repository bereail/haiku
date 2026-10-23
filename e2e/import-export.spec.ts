import fs from 'node:fs'
import { test, expect, type APIRequestContext } from '@playwright/test'
import { API_URL, bearer, storageStatePath } from './accounts'

// Importar/exportar backup (botones del encabezado, escritorio, cuenta admin local)
// contra el servidor real: tapas que el servidor ya no admite, duplicados y resumen.

test.use({ storageState: storageStatePath('admin') })

const RUN = Date.now()
const EXISTING = `Ya existente E2E ${RUN}`
const LEGACY = `Tapa vieja E2E ${RUN}`
const NEW = `Nuevo E2E ${RUN}`

async function adminBooks(request: APIRequestContext) {
  return (await (await request.get(`${API_URL}/books`, { headers: bearer('admin') })).json()) as Record<string, unknown>[]
}

test.afterEach(async ({ request }) => {
  for (const b of await adminBooks(request)) {
    if (String(b.title).endsWith(` E2E ${RUN}`)) {
      await request.delete(`${API_URL}/books/${b.id}`, { headers: bearer('admin') })
    }
  }
})

test('importar un backup: tapa no admitida → se importa sin tapa; duplicados → se saltean; resumen claro', async ({ page, request }) => {
  await request.post(`${API_URL}/books`, { headers: bearer('admin'), data: { title: EXISTING, author: 'Autora' } })
  await page.goto('')
  await expect(page.getByPlaceholder('Buscar por título o autor...')).toBeVisible()
  await expect(page.getByText('Cargando tu biblioteca…')).toHaveCount(0)

  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: 'Importar JSON' }).click()])
  await chooser.setFiles({
    name: 'backup.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ version: 1, books: [
      { title: EXISTING, author: 'Autora' },                                         // ya está
      { title: LEGACY, author: 'Autora', cover: 'https://books.google.com/x.jpg' },  // tapa que el servidor rechaza
      { title: NEW, author: 'Autora', startDate: '2026-01-01', endDate: '2026-02-01' },
    ] })),
  })

  await expect(page.getByText('Se importaron 2 de 3 libros. 1 ya estaban en tu biblioteca.')).toBeVisible()
  await expect(page.getByText(`1 se importaron sin tapa (formato no admitido): ${LEGACY}.`)).toBeVisible()

  const books = await adminBooks(request)
  expect(books.filter(b => b.title === EXISTING)).toHaveLength(1)
  expect(books.find(b => b.title === LEGACY)).toMatchObject({ cover: null })
  expect(books.find(b => b.title === NEW)).toMatchObject({ startDate: '2026-01-01', endDate: '2026-02-01' })
  await expect(page.getByRole('article', { name: NEW })).toBeVisible()
  await expect(page.getByRole('article', { name: LEGACY })).toBeVisible()
})

test('exportar y volver a importar el mismo backup no duplica nada', async ({ page, request }) => {
  await request.post(`${API_URL}/books`, { headers: bearer('admin'), data: { title: NEW, author: 'Autora', notes: 'nota' } })
  await page.goto('')
  await expect(page.getByRole('article', { name: NEW })).toBeVisible()

  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Exportar JSON' }).click()])
  const backupText = fs.readFileSync((await download.path())!, 'utf8')
  expect(JSON.parse(backupText).books.some((b: { title: string }) => b.title === NEW)).toBe(true)

  const before = (await adminBooks(request)).length
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: 'Importar JSON' }).click()])
  await chooser.setFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(backupText) })
  await expect(page.getByText(/^Se importaron 0 de \d+ libros\. \d+ ya estaban en tu biblioteca\.$/)).toBeVisible()
  expect((await adminBooks(request)).length).toBe(before)
})
