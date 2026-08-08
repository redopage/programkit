import { cloudflare } from '@cloudflare/vite-plugin'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const webSource = fileURLToPath(new URL('../../packages/web/src/index.ts', import.meta.url))
const webStyles = fileURLToPath(new URL('../../packages/web/src/styles.css', import.meta.url))

export default defineConfig(({ mode }) => ({
  plugins: [
    tanstackRouter({
      target: 'react',
      autoCodeSplitting: true,
      routesDirectory: '../../packages/web/src/routes',
      generatedRouteTree: '../../packages/web/src/routeTree.gen.ts',
    }),
    react(),
    tailwindcss(),
    ...(mode === 'test' ? [] : [cloudflare()]),
  ],
  resolve: {
    alias: [
      { find: '@programkit/web/styles.css', replacement: webStyles },
      { find: '@programkit/web', replacement: webSource },
    ],
    dedupe: ['react', 'react-dom'],
  },
}))
