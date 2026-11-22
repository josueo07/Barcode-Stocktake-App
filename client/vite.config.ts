import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon.svg'],
      manifest: {
        name: 'Inventario J&R',
        short_name: 'Inventario',
        description: 'Conteo de inventario con escáner de códigos de barras.',
        theme_color: '#1d4ed8',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
        ],
      },
      workbox: {
        // App-shell only: scan data is owned by IndexedDB (Dexie), not the service worker cache.
        globPatterns: ['**/*.{js,css,html,svg}'],
        // Deep links (e.g. /sessions/3/scan) open from cache in airplane mode; API calls never do.
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/socket\.io\//],
      },
    }),
  ],
  resolve: {
    alias: {
      '@barcode-stocktake/shared': path.resolve(__dirname, '../shared/src/index.ts'),
    },
  },
});
