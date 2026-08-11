import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss()],
  // pdfjs-dist ships as ESM with a worker we bundle ourselves (see src/lib/pdfjs.ts).
  // Nothing here may reach out to a CDN at runtime — the app must work with the network off.
  worker: { format: 'es' },
  build: {
    // Source maps ship so a stack from a user's browser can be read back
    // against real function names in their dev tools.
    sourcemap: true,
    // `--mode debug` keeps the output unminified, which is the only way an
    // on-screen stack trace names anything more useful than `e of t`.
    minify: mode !== 'debug',
  },
}))
