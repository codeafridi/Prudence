import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // relative asset URLs: works from any static host, including GitHub Pages subpaths
  base: './',
  plugins: [react(), tailwindcss()],
})
