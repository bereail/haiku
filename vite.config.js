import fs from 'node:fs'
import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// OCR local (Tesseract.js): por defecto baja el worker, el núcleo WASM y el idioma de
// jsDelivr. Este plugin los sirve desde el propio sitio en /ocr/ (en dev desde
// node_modules; en el build los copia a dist/ocr/), con las versiones fijadas por el
// lockfile y sin copiar binarios al repo.
const OCR_FILES = {
  'worker.min.js': 'node_modules/tesseract.js/dist/worker.min.js',
  'tesseract-core-simd-lstm.wasm.js': 'node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm.js',
  'tesseract-core-lstm.wasm.js': 'node_modules/tesseract.js-core/tesseract-core-lstm.wasm.js',
  // LSTM entero: buen equilibrio entre precisión y velocidad (2,1 MB)
  'spa.traineddata.gz': 'node_modules/@tesseract.js-data/spa/4.0.0_best_int/spa.traineddata.gz',
}
function ocrAssets() {
  return {
    name: 'librook-ocr-assets',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const m = req.url && req.url.match(/^\/librook\/ocr\/([^?]+)/)
        const src = m && OCR_FILES[m[1]]
        if (!src) return next()
        res.setHeader('Content-Type', m[1].endsWith('.js') ? 'text/javascript' : 'application/octet-stream')
        fs.createReadStream(path.resolve(src)).pipe(res)
      })
    },
    generateBundle() {
      for (const [name, src] of Object.entries(OCR_FILES)) {
        this.emitFile({ type: 'asset', fileName: `ocr/${name}`, source: fs.readFileSync(path.resolve(src)) })
      }
    },
  }
}

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/tests/setup.ts'],
    isolate: true,
    include: ['src/tests/**/*.test.{ts,tsx}'],
  },
  base: '/librook/',
  // Caché propia por servidor: dos dev servers con la misma caché se pisan
  cacheDir: process.env.VITE_CACHE_DIR || 'node_modules/.vite',
  server: {
    proxy: {
      '/librook-api': process.env.VITE_LOCAL_API === '1' ? {
        // Backend local (server/): no usa el prefijo /librook-api en sus rutas
        // LOCAL_API_PORT: para levantar un segundo stack (p. ej. el de E2E) sin
        // tocar el de desarrollo
        target: `http://localhost:${process.env.LOCAL_API_PORT || 3001}`,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/librook-api/, ''),
      } : {
        target: 'https://ailonline.com.ar',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  plugins: [
    react(),
    ocrAssets(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Librook',
        short_name: 'Librook',
        description: 'Tu biblioteca personal de libros',
        theme_color: '#2d4a3e',
        background_color: '#faf9f7',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/librook/',
        icons: [
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: 'favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        // El OCR (~6 MB) se baja solo si alguien lo usa: no se precachea para todos
        globIgnores: ['**/ocr/**'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/covers\.openlibrary\.org\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'openlibrary-covers',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
    }),
  ],
})
