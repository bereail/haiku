import type { Page } from '@playwright/test'

// Open Library simulado para las pruebas: búsqueda con datos fijos, tapas
// servidas localmente y cualquier otra salida a Open Library cortada, para que
// ninguna prueba dependa de internet (antes, el catálogo y las tapas salían a la
// red real y una respuesta lenta colgaba las esperas).

export const OL_MOCK_DOCS = [
  { key: '/works/OLMOCK1W', title: 'Rayuela (simulado)', author_name: ['Julio Cortázar'], publisher: ['Sudamericana'], first_publish_year: 1963, cover_i: 101 },
  { key: '/works/OLMOCK2W', title: 'Ficciones (simulado)', author_name: ['Jorge Luis Borges'], publisher: ['Sur'], first_publish_year: 1944 },
]

// PNG de 1×1 (gris) para las tapas
const COVER_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mN8//8/AwAI/AL+XJ/PvwAAAABJRU5ErkJggg==',
  'base64',
)

export async function mockOpenLibrary(page: Page, docs: object[] = OL_MOCK_DOCS) {
  await page.route('https://covers.openlibrary.org/**', route =>
    route.fulfill({ status: 200, contentType: 'image/png', body: COVER_PNG }))
  await page.route('https://openlibrary.org/**', route => {
    if (new URL(route.request().url()).pathname === '/search.json') {
      return route.fulfill({ json: { docs } })
    }
    // Nada más debería salir a Open Library desde estas pruebas
    return route.abort('blockedbyclient')
  })
}
