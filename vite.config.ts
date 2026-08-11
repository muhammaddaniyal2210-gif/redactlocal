import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // pdfjs-dist ships as ESM with a worker we bundle ourselves (see src/lib/pdfjs.ts).
  // Nothing here may reach out to a CDN at runtime — the app must work with the network off.
  worker: { format: 'es' },
})
