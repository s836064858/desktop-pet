import { fileURLToPath, URL } from 'node:url'

import vue from '@vitejs/plugin-vue'
import { defineConfig, loadEnv } from 'vite'
import aiCapability from './src-tauri/capabilities/ai-local.json'

const rootDirectory = fileURLToPath(new URL('./', import.meta.url))
const aiApiPath = '/api/v1/ai'

function resolveAiApiBaseUrl(mode: string): string {
  const { VITE_AI_API_ORIGIN: value = 'http://127.0.0.1:3000' } = loadEnv(
    mode,
    rootDirectory,
    'VITE_AI_API_ORIGIN',
  )
  const message = 'VITE_AI_API_ORIGIN 必须为 HTTPS 或本机 HTTP Origin，不能包含路径、参数或凭证。'
  if (!/^https?:\/\/[^\s/?#@\\]+\/?$/i.test(value)) throw new Error(message)
  const origin = URL.canParse(value) ? new URL(value) : null
  if (!origin || (origin.protocol === 'http:' && !['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname))) {
    throw new Error(message)
  }
  const baseUrl = origin.origin + aiApiPath
  const allowed = aiCapability.permissions.some(({ identifier, allow }) =>
    identifier === 'http:default' && allow.some(({ url }) => url === `${baseUrl}/*`),
  )
  if (!allowed) throw new Error('VITE_AI_API_ORIGIN 与 src-tauri/capabilities/ai-local.json 的 AI 白名单不一致。')
  return baseUrl
}

export default defineConfig(({ mode }) => ({
  plugins: [vue()],
  clearScreen: false,
  define: { __AI_API_BASE_URL__: JSON.stringify(resolveAiApiBaseUrl(mode)) },
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    target: 'esnext',
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        pet: fileURLToPath(new URL('./pet.html', import.meta.url)),
      },
    },
  },
}))
