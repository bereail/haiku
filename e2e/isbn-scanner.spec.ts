import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs'
import { test, expect } from '@playwright/test'
import { storageStatePath } from './accounts'
import { writeEan13Y4m } from './fixtures/ean13-video'

// Compatibilidad real del escáner de ISBN: Chromium de escritorio NO trae BarcodeDetector,
// así que se usa el lector ZXing (WASM) cargado de forma diferida. La "cámara" es un video
// generado con el código de barras EAN-13 del ISBN.

const ISBN = '9788437604947' // Cien años de soledad (Cátedra)
const VIDEO = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'librook-cam-')), 'ean13.y4m')
writeEan13Y4m(VIDEO, ISBN)

test.use({
  storageState: storageStatePath('lectora1'),
  permissions: ['camera'],
  launchOptions: {
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      `--use-file-for-fake-video-capture=${VIDEO}`,
    ],
  },
})

test('escanear el código de barras con la cámara completa los datos del libro (sin CDN externo)', async ({ page }) => {
  const external: string[] = []
  page.on('request', r => {
    const host = new URL(r.url()).hostname
    if (!['localhost', '127.0.0.1', 'openlibrary.org', 'covers.openlibrary.org', 'fonts.googleapis.com', 'fonts.gstatic.com'].includes(host)) external.push(r.url())
  })
  await page.route('https://openlibrary.org/search.json**', route => {
    const isbn = new URL(route.request().url()).searchParams.get('isbn')
    return route.fulfill({ json: { docs: isbn === ISBN ? [
      { key: '/works/OL3W', title: 'Cien años de soledad', author_name: ['Gabriel García Márquez'], publisher: ['Cátedra'], first_publish_year: 1967 },
    ] : [] } })
  })

  await page.goto('')
  await expect(page.getByText('Cargando tu biblioteca…')).toHaveCount(0)
  expect(await page.evaluate(() => 'BarcodeDetector' in window)).toBe(false) // camino ZXing

  await page.getByRole('button', { name: 'Agregar', exact: true }).click()
  const dialog = page.getByRole('dialog').first()
  const wasm = page.waitForResponse(r => r.url().includes('zxing_reader') && r.url().endsWith('.wasm'))
  const t0 = Date.now()
  await dialog.getByRole('button', { name: /Escanear ISBN/ }).click()

  const scanner = page.getByRole('dialog', { name: 'Escanear ISBN' })
  await expect(scanner).toBeVisible()
  const wasmResponse = await wasm
  expect(new URL(wasmResponse.url()).hostname).toBe('localhost') // servido por el propio sitio
  expect(wasmResponse.status()).toBe(200)

  // Detecta, cierra el escáner y completa el formulario con el resultado de la búsqueda
  await expect(scanner).toBeHidden({ timeout: 15000 })
  const elapsed = Date.now() - t0
  await expect(dialog.locator('#title')).toHaveValue('Cien años de soledad')
  await expect(dialog.locator('#author')).toHaveValue('Gabriel García Márquez')
  console.log(`Escaneo ZXing: ${elapsed} ms desde abrir el escáner hasta completar el formulario`)
  expect(external).toEqual([])
})

test('sin cámara disponible, el escáner lo explica y ofrece la entrada manual', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'mediaDevices', { value: undefined, configurable: true })
  })
  await page.goto('')
  await expect(page.getByText('Cargando tu biblioteca…')).toHaveCount(0)
  await page.getByRole('button', { name: 'Agregar', exact: true }).click()
  await page.getByRole('dialog').first().getByRole('button', { name: /Escanear ISBN/ }).click()
  const scanner = page.getByRole('dialog', { name: 'Escanear ISBN' })
  await expect(scanner.getByRole('status')).toContainText('no tiene una cámara disponible')
  await expect(scanner.getByRole('status')).toContainText('Ingresá el ISBN manualmente')
})
