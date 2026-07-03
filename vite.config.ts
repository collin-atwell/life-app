import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // Relative base so the same build works on GitHub Pages (served from
  // /<repo-name>/) and any other static host.
  base: './',
  plugins: [react()],
  server: {
    fs: {
      // The project path contains ':' characters, which trips Vite's
      // allow-list path matching — disable strict fs checks for local dev.
      strict: false,
    },
  },
})
