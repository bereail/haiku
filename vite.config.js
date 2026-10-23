import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

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
