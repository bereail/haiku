import { execFileSync } from 'node:child_process'
import { test, expect, type APIRequestContext } from '@playwright/test'
import { ACCOUNTS, API_URL, BASE_URL, bearer } from './accounts'

// Página pública de una obra: muestra reseñas compartidas y cuántas personas
// tienen el libro, pero nunca notas privadas, fechas de lectura ni emails.

const RUN = Date.now()
const TITLE = `Obra pública E2E ${RUN}`
const SHARED = `Reseña compartida E2E ${RUN}`
const PRIVATE = `Nota PRIVADA de lectora2 E2E ${RUN}`

let obraId: string
let editionId: string
const created: { who: 'lectora1' | 'lectora2'; id: string }[] = []

function sql(query: string): string {
  // Solo la base LOCAL (contenedor librook-pg). Los valores interpolados son
  // constantes de este archivo (título con un número), sin entrada externa.
  return execFileSync('docker', ['exec', 'librook-pg', 'psql', '-U', 'librook_user', '-d', 'librook_db', '-tAc', query])
    .toString().trim().split('\n')[0].trim() // con RETURNING, la 1.ª línea es el valor
}

async function addLinkedBook(request: APIRequestContext, who: 'lectora1' | 'lectora2', notes: string) {
  const res = await request.post(`${API_URL}/books`, {
    headers: bearer(who),
    data: { title: TITLE, author: 'Autora Pública E2E', notes, score: 5, editionId, startDate: '2026-03-03', endDate: '2026-04-04' },
  })
  expect(res.ok()).toBeTruthy()
  const id = (await res.json()).id
  created.push({ who, id })
  return id
}

test.beforeAll(async ({ request }) => {
  obraId = sql(`INSERT INTO obras (canonical_title, first_publish_year, source) VALUES ('${TITLE}', 1999, 'manual') RETURNING id`)
  const autorId = sql(`INSERT INTO autores (name) VALUES ('Autora Pública E2E') RETURNING id`)
  sql(`INSERT INTO obra_autores (obra_id, autor_id) VALUES ('${obraId}', '${autorId}')`)
  editionId = sql(`INSERT INTO ediciones (obra_id, title, publisher, publish_year, source) VALUES ('${obraId}', '${TITLE}', 'Editorial E2E', 2001, 'manual') RETURNING id`)

  const mine = await addLinkedBook(request, 'lectora1', SHARED)
  await addLinkedBook(request, 'lectora2', PRIVATE) // nunca se comparte
  const post = await request.post(`${API_URL}/community/posts`, { headers: bearer('lectora1'), data: { bookId: mine, reflection: SHARED } })
  expect(post.ok()).toBeTruthy()
})

test.afterAll(async ({ request }) => {
  for (const b of created) await request.delete(`${API_URL}/books/${b.id}`, { headers: bearer(b.who) })
  sql(`DELETE FROM community_posts WHERE obra_id = '${obraId}'`)
  sql(`DELETE FROM obras WHERE id = '${obraId}'`) // ediciones y obra_autores en cascada
  sql(`DELETE FROM autores a WHERE name = 'Autora Pública E2E' AND NOT EXISTS (SELECT 1 FROM obra_autores oa WHERE oa.autor_id = a.id)`)
})

test('sin sesión: muestra la obra, la reseña compartida y cuántas personas la tienen', async ({ page }) => {
  await page.goto(`${BASE_URL}catalog/obra/${obraId}`)
  await expect(page.getByRole('heading', { level: 1, name: TITLE })).toBeVisible()
  await expect(page.getByText('Autora Pública E2E')).toBeVisible()
  await expect(page.getByText('2 personas tienen este libro')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Reseñas de la comunidad (1)' })).toBeVisible()
  await expect(page.getByText(SHARED)).toBeVisible()
  await expect(page.getByText('Editorial E2E')).toBeVisible()
})

test('nunca expone notas privadas, fechas de lectura ni emails (UI y API)', async ({ page, request }) => {
  await page.goto(`${BASE_URL}catalog/obra/${obraId}`)
  await expect(page.getByText(SHARED)).toBeVisible()
  const body = await page.locator('body').innerText()
  expect(body).not.toContain(PRIVATE)
  expect(body).not.toContain(ACCOUNTS.lectora1.email)
  expect(body).not.toContain(ACCOUNTS.lectora2.email)

  const api = await request.get(`${API_URL}/catalog/works/${obraId}`) // sin token
  expect(api.ok()).toBeTruthy()
  const raw = await api.text()
  expect(raw).not.toContain(PRIVATE)
  // Sin alias elegido, el nombre público no sale del email (antes era "lectora1")
  const alias = (await api.json()).reviews[0].authorAlias
  expect(alias).toMatch(/^Lector\/a [0-9A-F]{4}$/)
  expect(alias).not.toContain('lectora1')
  await expect(page.getByText(alias)).toBeVisible()
  expect(raw).not.toMatch(/@test\.dev|"notes"|start_?date|end_?date|2026-03-03|2026-04-04|"email"/i)
})

test('dejar de compartir quita la reseña de la página pública', async ({ page, request }) => {
  const posts = await (await request.get(`${API_URL}/community/posts`, { headers: bearer('lectora1') })).json()
  const mine = posts.posts.find((p: { reflection: string }) => p.reflection === SHARED)
  expect((await request.delete(`${API_URL}/community/posts/${mine.id}`, { headers: bearer('lectora1') })).ok()).toBeTruthy()

  await page.goto(`${BASE_URL}catalog/obra/${obraId}`)
  await expect(page.getByRole('heading', { name: 'Reseñas de la comunidad (0)' })).toBeVisible()
  await expect(page.getByText(SHARED)).toHaveCount(0)
})

test('una obra inexistente muestra un error claro', async ({ page }) => {
  await page.goto(`${BASE_URL}catalog/obra/00000000-0000-0000-0000-000000000000`)
  await expect(page.getByRole('alert')).toHaveText('No encontramos esta obra.')
})
