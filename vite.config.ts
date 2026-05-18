import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const { version } = JSON.parse(
  readFileSync(resolve(import.meta.dirname, 'package.json'), 'utf-8')
) as { version: string }

export default defineConfig({
  root: 'client',
  plugins: [preact()],
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(version),
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:9995',
      '/login': {
        target: 'http://localhost:9995',
        bypass(req) {
          return req.method === 'GET' ? '/index.html' : undefined
        },
      },
      '/logout': 'http://localhost:9995',
      '/analyzeCSV': 'http://localhost:9995',
      '/registerUsers': 'http://localhost:9995',
      '/addParticipation': 'http://localhost:9995',
      '/jobs': 'http://localhost:9995',
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})
