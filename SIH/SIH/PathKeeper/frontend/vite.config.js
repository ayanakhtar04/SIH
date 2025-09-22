import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// Backend URL: default now points to Node auth backend on port 6060.
// Override via env BACKEND_URL (PowerShell example):
//   $env:BACKEND_URL="http://localhost:6060"; npm run dev
// Or create .env.local with BACKEND_URL=http://localhost:6060
const BACKEND_URL = (globalThis?.process && globalThis.process.env?.BACKEND_URL) || 'http://localhost:6060';

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
