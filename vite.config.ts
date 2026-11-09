import { copyFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

// GitHub Pages serves 404.html for paths with no matching file, which lets
// the app load on routes such as /fourier-wave-lab and pick the page itself.
function githubPagesSpaFallback(): Plugin {
  let outDir = ''

  return {
    name: 'github-pages-spa-fallback',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir)
    },
    async closeBundle() {
      await copyFile(resolve(outDir, 'index.html'), resolve(outDir, '404.html'))
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  base: '/Interactive-Science-Labs/',
  plugins: [react(), githubPagesSpaFallback()],
})
