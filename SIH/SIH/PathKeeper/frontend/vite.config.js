import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// Backend URL: default now points to port 5055.
// Override via env BACKEND_URL when running `npm run dev` (PowerShell: $env:BACKEND_URL="http://localhost:5055").
// Examples:
//   $env:BACKEND_URL="http://localhost:5055"; npm run dev
//   (Persist) create .env.local with: BACKEND_URL=http://localhost:5055
const BACKEND_URL = (globalThis?.process && globalThis.process.env?.BACKEND_URL) || 'http://localhost:5055';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: BACKEND_URL,
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
