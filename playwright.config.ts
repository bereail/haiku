import { defineConfig, devices } from '@playwright/test'

/**
 * Apunta al entorno local (frontend :5173 + backend :3001, ver la
 * sección "Entorno local de desarrollo" en la memoria del proyecto).
 * NUNCA correr contra producción — no hay forma de aislar datos reales
 * de usuarios ahí.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173/librook/',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
})
