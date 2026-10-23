import AxeBuilder from '@axe-core/playwright'
import { test, expect, type APIRequestContext, type Page } from '@playwright/test'
import { ACCOUNTS, API_URL, bearer, storageStatePath, type AccountName } from './accounts'

// Comunidad: compartir una reseña desde el detalle del libro, dar y quitar
// "me gusta", comentar, y borrar solo lo propio (UI y API).

const RUN = Date.now()
const MINE = `Libro propio E2E ${RUN}`
const THEIRS = `Libro ajeno E2E ${RUN}`
const MY_NOTE = `Mi reflexión E2E ${RUN}`
const THEIR_NOTE = `Reflexión de lectora2 E2E ${RUN}`

let myBookId: string
let theirBookId: string
let theirPostId: string

async function createBook(request: APIRequestContext, who: AccountName, title: string, notes: string) {
  const res = await request.post(`${API_URL}/books`, { headers: bearer(who), data: { title, author: 'Autora E2E', notes, score: 4 } })
  expect(res.ok()).toBeTruthy()
  return (await res.json()).id as string
}

async function openCommunity(page: Page) {
  await page.goto('')
  await page.getByRole('button', { name: 'Comunidad' }).click()
  const dialog = page.getByRole('dialog', { name: 'Comunidad' })
  await expect(dialog).toBeVisible()
  return dialog
}

test.describe.configure({ mode: 'serial' })
test.use({ storageState: storageStatePath('lectora1') })

test.beforeAll(async ({ request }) => {
  myBookId = await createBook(request, 'lectora1', MINE, MY_NOTE)
  theirBookId = await createBook(request, 'lectora2', THEIRS, THEIR_NOTE)
  const post = await request.post(`${API_URL}/community/posts`, {
    headers: bearer('lectora2'), data: { bookId: theirBookId, reflection: THEIR_NOTE },
  })
  expect(post.ok()).toBeTruthy()
  theirPostId = (await post.json()).id
})

test.afterAll(async ({ request }) => {
  await request.delete(`${API_URL}/community/posts/${theirPostId}`, { headers: bearer('lectora2') })
  await request.delete(`${API_URL}/books/${theirBookId}`, { headers: bearer('lectora2') })
  await request.delete(`${API_URL}/books/${myBookId}`, { headers: bearer('lectora1') })
})

test('compartir una reseña desde el detalle del libro y dejar de compartirla', async ({ page }) => {
  await page.goto('')
  const card = page.getByRole('article', { name: MINE })
  await card.click()
  await card.click() // segundo click: abre el detalle
  const detail = page.getByRole('dialog', { name: MINE })
  const share = detail.getByRole('checkbox', { name: /Compartir en Comunidad/ })
  // Con teclado (el input está oculto visualmente; su etiqueta muestra el foco)
  await share.focus()
  await page.keyboard.press('Space')
  await expect(detail.getByRole('checkbox', { name: /Compartido en Comunidad/ })).toBeChecked()
  await page.keyboard.press('Escape')

  const community = await openCommunity(page)
  const post = community.getByRole('article', { name: MINE })
  await expect(post).toContainText(MY_NOTE)
  // Se muestra el alias, nunca el email completo
  await expect(post).not.toContainText(ACCOUNTS.lectora1.email)
  await page.keyboard.press('Escape')

  // openCommunity recargó la página: la tarjeta volvió a su frente
  await card.click()
  await card.click()
  await page.getByRole('dialog', { name: MINE }).getByRole('checkbox', { name: /Compartido en Comunidad/ }).focus()
  await page.keyboard.press('Space')
  await expect(page.getByRole('dialog', { name: MINE }).getByRole('checkbox', { name: /Compartir en Comunidad/ })).not.toBeChecked()
  await page.keyboard.press('Escape')
  const again = await openCommunity(page)
  await expect(again.getByRole('article', { name: MINE })).toHaveCount(0)
})

test('"me gusta": nombre fijo con el contador, aria-pressed y persistencia', async ({ page, request }) => {
  const community = await openCommunity(page)
  const post = community.getByRole('article', { name: THEIRS })
  const like = post.getByRole('button', { name: /^Me gusta/ })
  await expect(like).toHaveAttribute('aria-pressed', 'false')
  await expect(like).toHaveAccessibleName('Me gusta 0')

  await like.click()
  await expect(like).toHaveAttribute('aria-pressed', 'true')
  await expect(like).toHaveAccessibleName('Me gusta 1')
  // La UI actualiza al instante; el servidor confirma enseguida
  await expect.poll(async () => {
    const posts = await (await request.get(`${API_URL}/community/posts`, { headers: bearer('lectora2') })).json()
    return posts.posts.find((p: { id: string }) => p.id === theirPostId).likeCount
  }).toBe(1)

  await like.click()
  await expect(like).toHaveAttribute('aria-pressed', 'false')
  await expect(like).toHaveAccessibleName('Me gusta 0')
})

test('comentar en una publicación ajena y borrar solo el comentario propio', async ({ page, request }) => {
  // lectora2 comenta primero en su propia publicación
  await request.post(`${API_URL}/community/posts/${theirPostId}/comments`, { headers: bearer('lectora2'), data: { body: 'Comentario de lectora2' } })

  const community = await openCommunity(page)
  const post = community.getByRole('article', { name: THEIRS })
  const toggle = post.getByRole('button', { name: /^Comentarios/ })
  await expect(toggle).toHaveAccessibleName('Comentarios 1')
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  await expect(post.getByText('Comentario de lectora2')).toBeVisible()

  await post.getByRole('textbox', { name: 'Escribir comentario' }).fill('Mi comentario E2E')
  await post.getByRole('button', { name: 'Comentar', exact: true }).click()
  await expect(post.getByText('Mi comentario E2E')).toBeVisible()

  // Solo se puede borrar el propio
  await expect(post.getByRole('button', { name: 'Eliminar comentario' })).toHaveCount(1)
  await post.getByRole('button', { name: 'Eliminar comentario' }).click()
  await expect(post.getByText('Mi comentario E2E')).toHaveCount(0)
  await expect(post.getByText('Comentario de lectora2')).toBeVisible()
})

test('no hay botón para borrar publicaciones ajenas, y la API tampoco lo permite', async ({ page, request }) => {
  const own = await request.post(`${API_URL}/community/posts/${theirPostId}/comments`, { headers: bearer('lectora2'), data: { body: `Comentario a proteger ${RUN}` } })
  const theirComment = await own.json()
  const community = await openCommunity(page)
  const post = community.getByRole('article', { name: THEIRS })
  await expect(post.getByRole('button', { name: 'Eliminar publicación' })).toHaveCount(0)

  const del = await request.delete(`${API_URL}/community/posts/${theirPostId}`, { headers: bearer('lectora1') })
  expect(del.status()).toBe(404)
  expect((await request.delete(`${API_URL}/community/comments/${theirComment.id}`, { headers: bearer('lectora1') })).status()).toBe(404)
  // Siguen existiendo
  const comments = await (await request.get(`${API_URL}/community/posts/${theirPostId}/comments`, { headers: bearer('lectora1') })).json()
  expect(comments.comments.some((c: { id: string }) => c.id === theirComment.id)).toBe(true)
  const after = await (await request.get(`${API_URL}/community/posts`, { headers: bearer('lectora1') })).json()
  expect(after.posts.some((p: { id: string }) => p.id === theirPostId)).toBe(true)
})

test('API: validaciones y contenido HTML que no se ejecuta', async ({ page, request }) => {
  const h = bearer('lectora1')
  expect((await request.post(`${API_URL}/community/posts/${theirPostId}/comments`, { headers: h, data: { body: '   ' } })).status()).toBe(400)
  expect((await request.post(`${API_URL}/community/posts/${theirPostId}/comments`, { headers: h, data: { body: 'x'.repeat(5000) } })).status()).toBe(400)
  expect((await request.post(`${API_URL}/community/posts/00000000-0000-0000-0000-000000000000/likes`, { headers: h })).status()).toBe(404)

  // Un comentario con HTML se muestra como texto, no se interpreta
  const evil = `<img src=x onerror="window.__xss=1">E2E-XSS-${RUN}`
  await request.post(`${API_URL}/community/posts/${theirPostId}/comments`, { headers: h, data: { body: evil } })
  const community = await openCommunity(page)
  const post = community.getByRole('article', { name: THEIRS })
  await post.getByRole('button', { name: /^Comentarios/ }).click()
  await expect(post.getByText(evil)).toBeVisible()
  expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined()
  await expect(post.locator('img[src="x"]')).toHaveCount(0)
})

test('axe: comunidad con publicaciones y comentarios abiertos', async ({ page }) => {
  const community = await openCommunity(page)
  const post = community.getByRole('article', { name: THEIRS })
  await post.getByRole('button', { name: /^Comentarios/ }).click()
  // Comentarios cargados: aparece el campo para comentar
  await expect(post.getByRole('textbox', { name: 'Escribir comentario' })).toBeVisible()
  const { violations } = await new AxeBuilder({ page }).include('[role="dialog"]')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze()
  expect(violations.map(v => `${v.id}: ${v.nodes.map(n => n.target.join(' ')).join(', ')}`)).toEqual([])
})
