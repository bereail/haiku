import AxeBuilder from '@axe-core/playwright'
import { test, expect, type Page } from '@playwright/test'
import { storageStatePath } from './accounts'

// OCR local de tapas: Tesseract.js en el navegador, archivos servidos por el propio sitio,
// la foto nunca sale del dispositivo, y la persona confirma el resultado.

test.use({ storageState: storageStatePath('lectora1') })
// Medido en este equipo (stack local): lectura en frío ~1,7 s (incluye bajar ~6 MB de
// localhost e iniciar el motor), reconocimiento ~0,7 s, en caliente ~1,6 s. Las esperas de
// 20 s dejan margen para equipos más lentos sin esconder un cuelgue real.
const OCR_WAIT = 20_000

async function coverImage(page: Page, lines: { text: string; size: number }[]): Promise<Buffer> {
  const b64 = await page.evaluate((lines) => {
    const c = document.createElement('canvas'); c.width = 900; c.height = 1300
    const ctx = c.getContext('2d')!
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, c.width, c.height)
    ctx.fillStyle = '#111111'; ctx.textAlign = 'center'
    let y = 300
    for (const l of lines) { ctx.font = `bold ${l.size}px Georgia, serif`; ctx.fillText(l.text, c.width / 2, y); y += l.size * 1.8 }
    return c.toDataURL('image/png').split(',')[1]
  }, lines)
  return Buffer.from(b64, 'base64')
}

async function openOcr(page: Page) {
  await page.goto('')
  await expect(page.getByText('Cargando tu biblioteca…')).toHaveCount(0)
  await page.getByRole('button', { name: 'Agregar', exact: true }).click()
  const form = page.getByRole('dialog').first()
  await form.getByRole('button', { name: 'Identificar por foto' }).click()
  const ocr = page.getByRole('dialog', { name: 'Identificar por foto de la tapa' })
  await expect(ocr).toBeVisible()
  await expect(ocr).toContainText('no se envía a ningún servidor')
  return { form, ocr }
}

test('reconoce la tapa, propone el libro y completa el formulario solo al confirmarlo (sin CDN ni subida)', async ({ page }) => {
  const external: string[] = []
  const posts: string[] = []
  page.on('request', r => {
    const host = new URL(r.url()).hostname
    if (!['localhost', '127.0.0.1', 'openlibrary.org', 'covers.openlibrary.org', 'fonts.googleapis.com', 'fonts.gstatic.com'].includes(host)) external.push(r.url())
    if (r.method() !== 'GET' && !r.url().includes('/analytics/track')) posts.push(`${r.method()} ${r.url()}`)
  })
  const queries: string[] = []
  await page.route('https://openlibrary.org/search.json**', route => {
    const q = new URL(route.request().url()).searchParams.get('q') || ''
    queries.push(q)
    return route.fulfill({ json: { docs: /rayuela/i.test(q) ? [
      { key: '/works/OL1W', title: 'Rayuela', author_name: ['Julio Cortázar'], publisher: ['Sudamericana'], first_publish_year: 1963 },
    ] : [] } })
  })

  const { form, ocr } = await openOcr(page)
  const image = await coverImage(page, [{ text: 'RAYUELA', size: 130 }, { text: 'JULIO CORTÁZAR', size: 64 }])
  const t0 = Date.now()
  await ocr.locator('input[type="file"]').first().setInputFiles({ name: 'tapa.png', mimeType: 'image/png', buffer: image })
  await expect(ocr.getByRole('status').first()).toBeVisible()

  const query = ocr.getByLabel('Texto reconocido (podés corregirlo)')
  await expect(query).toBeVisible({ timeout: OCR_WAIT })
  const coldMs = Date.now() - t0
  await expect(query).toHaveValue(/RAYUELA/i)
  await expect(ocr).toContainText('no es infalible')
  console.log(`OCR en frío (descarga + inicio + lectura): ${coldMs} ms; ${await ocr.locator('text=/Lectura:/').textContent()}; texto: "${await query.inputValue()}"`)

  // Propone el candidato; el formulario NO cambia hasta confirmarlo
  await expect(form.locator('#title')).toHaveValue('')
  await ocr.getByRole('button', { name: 'Usar este libro: Rayuela' }).click()
  await expect(ocr).toBeHidden()
  await expect(form.locator('#title')).toHaveValue('Rayuela')
  await expect(form.locator('#author')).toHaveValue('Julio Cortázar')
  await expect(form).toBeVisible() // no se guardó nada: el formulario sigue abierto

  expect(queries.some(q => /rayuela/i.test(q))).toBe(true)
  expect(external).toEqual([])  // ni jsDelivr ni otros CDN
  expect(posts).toEqual([])     // la foto no se subió a ningún lado

  // Segunda lectura (archivos ya en caché): tiempo en caliente
  await form.getByRole('button', { name: 'Identificar por foto' }).click()
  const t1 = Date.now()
  await ocr.locator('input[type="file"]').first().setInputFiles({ name: 'tapa.png', mimeType: 'image/png', buffer: image })
  await expect(query).toHaveValue(/RAYUELA/i, { timeout: OCR_WAIT })
  console.log(`OCR en caliente: ${Date.now() - t1} ms`)
})

test('si no reconoce texto, ofrece buscar a mano, corregir y volver a fotografiar', async ({ page }) => {
  await page.route('https://openlibrary.org/search.json**', route => {
    const q = new URL(route.request().url()).searchParams.get('q') || ''
    return route.fulfill({ json: { docs: /ficciones/i.test(q) ? [
      { key: '/works/OL2W', title: 'Ficciones', author_name: ['Jorge Luis Borges'], first_publish_year: 1944 },
    ] : [] } })
  })
  const { form, ocr } = await openOcr(page)
  const blank = await coverImage(page, [])
  await ocr.locator('input[type="file"]').first().setInputFiles({ name: 'vacia.png', mimeType: 'image/png', buffer: blank })
  const query = ocr.getByLabel('Texto reconocido (podés corregirlo)')
  await expect(query).toBeVisible({ timeout: OCR_WAIT })
  await expect(ocr).toContainText('No se reconoció texto en la foto')

  // Corregir a mano y buscar
  await query.fill('Ficciones Borges')
  await ocr.getByRole('button', { name: 'Buscar', exact: true }).click()
  await expect(ocr.getByRole('button', { name: 'Usar este libro: Ficciones' })).toBeVisible()

  // axe sobre el diálogo con resultados
  const { violations } = await new AxeBuilder({ page }).include('[role="dialog"][aria-labelledby="cover-ocr-title"]')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
  expect(violations.map(v => `${v.id}: ${v.nodes.map(n => n.target.join(' ')).join(', ')}`)).toEqual([])

  // Volver a fotografiar abre de nuevo el selector de archivos
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), ocr.getByRole('button', { name: 'Volver a fotografiar' }).click()])
  expect(chooser).toBeTruthy()

  // "Buscar a mano" cierra y deja el formulario intacto
  await page.keyboard.press('Escape')
  await expect(ocr).toBeHidden()
  await expect(form.locator('#title')).toHaveValue('')
})
