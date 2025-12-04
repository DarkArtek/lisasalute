import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate', // Aggiorna l'app automaticamente se rilasci nuove versioni
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'Lisa Salute AI',
        short_name: 'Lisa',
        description: 'Assistente Medico Personale e Supporto SUEM',
        theme_color: '#ffffff', // Colore della barra di stato
        background_color: '#ffffff', // Colore di sfondo allo splash screen
        display: 'standalone', // Nasconde la barra del browser
        orientation: 'portrait', // Blocca in verticale (opzionale, utile per chat)
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable' // Per icone Android adattive
          }
        ]
      },
      workbox: {
        // Opzioni di caching avanzate
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        // Nota: Le chiamate API a Supabase e Gemini NON vengono cachate qui per sicurezza e real-time
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // <== 365 giorni
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      }
    })
  ],
  build: {
    chunkSizeWarningLimit: 2000 // Aumenta il limite per accomodare librerie pesanti (es. jsPDF)
  }
})
