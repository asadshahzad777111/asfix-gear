import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const buildId = (
  process.env.VERCEL_GIT_COMMIT_SHA
  || process.env.CF_PAGES_COMMIT_SHA
  || process.env.GITHUB_SHA
  || `local-${Date.now().toString(36)}`
).slice(0, 7);

export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  define: {
    __ASFIX_BUILD_ID__: JSON.stringify(buildId),
  },
  plugins: [
    react(),
    VitePWA({
      // One-release kill switch: new sw.js unregisters itself and deletes all
      // caches on activate so stale apex/www shells cannot stick after deploy.
      selfDestroying: true,
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'logo.png', 'apple-touch-icon.png', 'logo-192.png', 'logo-512.png'],
      manifest: {
        name: 'AsFix & Gear',
        short_name: 'AsFix',
        description: 'Mobile repair & premium accessories — Asad Shahzad',
        theme_color: '#0c0c12',
        background_color: '#0c0c12',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: '/logo-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/logo-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png', purpose: 'any' },
        ],
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/framer-motion')) return 'motion';
          if (id.includes('node_modules/react-dom')) return 'react-dom';
          if (id.includes('node_modules/react-router')) return 'router';
          if (id.includes('node_modules/react/')) return 'react';
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
      },
    },
  },
});
