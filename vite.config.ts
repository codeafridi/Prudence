import type { Plugin } from 'vite'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * Production-only CSP. It must not run in dev: @vitejs/plugin-react injects an inline preamble
 * script for HMR, which `script-src 'self'` would block.
 *
 * `connect-src *` is unavoidable — the model endpoint is whatever URL the user configures — but
 * `script-src 'self'` still blocks injected third-party scripts, which is the only realistic way
 * to read API keys out of localStorage. `object-src`/`base-uri` are cheap.
 * `frame-ancestors` is deliberately absent: it is ignored in a <meta> policy and logs an error;
 * set it as a header if you host this yourself.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'", // React Flow sets element styles inline
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  'connect-src *',
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ')

const cspPlugin: Plugin = {
  name: 'prudence-csp',
  apply: 'build',
  transformIndexHtml() {
    return [
      {
        tag: 'meta',
        attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP },
        injectTo: 'head-prepend',
      },
    ]
  },
}

export default defineConfig({
  // relative asset URLs: works from any static host, including GitHub Pages subpaths
  base: './',
  plugins: [react(), tailwindcss(), cspPlugin],
})
