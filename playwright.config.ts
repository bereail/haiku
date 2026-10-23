import { defineConfig, devices } from '@playwright/test'
import { BASE_URL } from './e2e/accounts'

/**
 * Apunta al entorno local (frontend :5173 + backend :3001, ver la
 * sección "Entorno local de desarrollo" en la memoria del proyecto).
 * NUNCA correr contra producción — no hay forma de aislar datos reales
 * de usuarios ahí.
 */
export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
})
