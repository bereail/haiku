import { test, expect } from '@playwright/test'

// Cuenta de prueba fija del entorno local (ver memoria del proyecto,
// "Entorno local de desarrollo") — nunca credenciales reales.
const TEST_EMAIL = 'lectora1@test.dev'
const TEST_PASSWORD = 'test1234'

test.describe('Autenticación', () => {
  test('una ruta protegida sin sesión muestra el login, no la biblioteca', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Bienvenida' })).toBeVisible()
    await expect(page.getByPlaceholder('Buscar por título o autor...')).not.toBeVisible()
  })

  test('login real contra el backend lleva a la biblioteca', async ({ page }) => {
    await page.goto('/')
    await page.locator('#email').fill(TEST_EMAIL)
    await page.locator('#password').fill(TEST_PASSWORD)
    await page.getByRole('button', { name: 'Ingresar' }).click()

    await expect(page.getByPlaceholder('Buscar por título o autor...')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Bienvenida' })).not.toBeVisible()
  })

  test('logout vuelve al login y limpia la sesión', async ({ page }) => {
    await page.goto('/')
    await page.locator('#email').fill(TEST_EMAIL)
    await page.locator('#password').fill(TEST_PASSWORD)
    await page.getByRole('button', { name: 'Ingresar' }).click()
    await expect(page.getByPlaceholder('Buscar por título o autor...')).toBeVisible()

    await page.getByRole('button', { name: 'Cerrar sesión' }).click()
    await expect(page.getByRole('heading', { name: 'Bienvenida' })).toBeVisible()

    // Recargar no debe revivir la sesión cerrada
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Bienvenida' })).toBeVisible()
  })

  test('credenciales inválidas muestran un error, no acceso', async ({ page }) => {
    await page.goto('/')
    await page.locator('#email').fill(TEST_EMAIL)
    await page.locator('#password').fill('contraseña-incorrecta')
    await page.getByRole('button', { name: 'Ingresar' }).click()

    await expect(page.getByRole('alert')).toBeVisible()
    await expect(page.getByPlaceholder('Buscar por título o autor...')).not.toBeVisible()
  })
})
