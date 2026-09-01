import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'MedRep',
        short_name: 'MedRep',
        description: 'Medical representative field tool',
        theme_color: '#0f766e',
        background_color: '#f4f6f8',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: 'favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        navigateFallback: 'index.html',
        runtimeCaching: [
          {
            urlPattern: ({ url }) =>
              url.hostname === 'script.google.com' ||
              url.hostname === 'script.googleusercontent.com',
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
})
