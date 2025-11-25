import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  build: {
    // Aumentiamo il limite dell'avviso a 2MB (2000kB) per accomodare jsPDF
    chunkSizeWarningLimit: 2000,
  },
})
