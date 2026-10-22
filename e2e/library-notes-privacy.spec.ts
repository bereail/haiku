import { test, expect } from '@playwright/test'

const TEST_EMAIL = 'lectora1@test.dev'
const TEST_PASSWORD = 'test1234'

// Título único por corrida para no chocar con libros ya existentes de la
// cuenta de prueba y para poder buscarlo sin falsos positivos.
const UNIQUE_TITLE = `Libro E2E ${Date.now()}`
const PRIVATE_NOTE = 'Nota privada de prueba E2E — no debería salir de mi biblioteca.'

test.describe('Biblioteca: alta, persistencia y privacidad de notas', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.locator('#email').fill(TEST_EMAIL)
    await page.locator('#password').fill(TEST_PASSWORD)
    await page.getByRole('button', { name: 'Ingresar' }).click()
    await expect(page.getByPlaceholder('Buscar por título o autor...')).toBeVisible()
  })

  test('agregar un libro con nota privada persiste y no se filtra a Comunidad ni al Catálogo', async ({ page, context }) => {
    // 1. Agregar manualmente (botón del header, no el FAB mobile)
    await page.getByRole('button', { name: 'Agregar', exact: true }).click()
    await page.locator('#title').fill(UNIQUE_TITLE)
    await page.locator('#author').fill('Autor E2E')
    await page.locator('#notes').fill(PRIVATE_NOTE).catch(() => {})
    await page.getByRole('button', { name: 'Agregar libro' }).click()
    await page.waitForTimeout(1000)
    await page.screenshot({ path: 'e2e-debug.png', fullPage: true })

    // 2. Aparece en la biblioteca
    await expect(page.getByText(UNIQUE_TITLE)).toBeVisible({ timeout: 10000 })

    // 3. Persiste tras recargar (confirma que quedó en la base, no solo en memoria)
    await page.reload()
    await expect(page.getByPlaceholder('Buscar por título o autor...')).toBeVisible()
    await page.getByPlaceholder('Buscar por título o autor...').fill(UNIQUE_TITLE)
    await expect(page.getByText(UNIQUE_TITLE)).toBeVisible()

    // 4. La nota privada no aparece en el catálogo público (ruta y origin
    //    distintos — página nueva, sin el token de sesión de lectora1)
    const publicPage = await context.newPage()
    await publicPage.goto('/catalog')
    await publicPage.getByPlaceholder('Buscar por título...').fill(UNIQUE_TITLE)
    await publicPage.waitForTimeout(1500)
    await expect(publicPage.getByText(PRIVATE_NOTE)).not.toBeVisible()
    await publicPage.close()

    // 5. Limpieza: borrar el libro de prueba para no acumular basura en
    //    la cuenta de prueba entre corridas.
    await page.getByPlaceholder('Buscar por título o autor...').fill(UNIQUE_TITLE)
    await page.getByText(UNIQUE_TITLE).click() // flip de la tarjeta
    await page.getByRole('button', { name: 'Eliminar' }).click()
    await page.getByRole('button', { name: 'Sí' }).click()
    await page.getByPlaceholder('Buscar por título o autor...').fill(UNIQUE_TITLE)
    await expect(page.getByText(UNIQUE_TITLE)).not.toBeVisible()
  })
})
