import { fileURLToPath } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig, loadEnv } from 'vite'

const adminDirectory = fileURLToPath(new URL('./', import.meta.url))
const brandDirectory = fileURLToPath(new URL('../src/assets/brand/', import.meta.url))
const iconDirectory = fileURLToPath(new URL('../src/components/common/', import.meta.url))
const plantDirectory = fileURLToPath(
  new URL('../src/assets/pets/pothos/juvenile/', import.meta.url),
)

function readPort(name: string, value: string): number {
  const port = Number(value)
  if (!/^\d+$/.test(value) || port < 1 || port > 65535)
    throw new Error(`${name} 必须为有效端口。`)
  return port
}

export default defineConfig(({ mode }) => {
  const { ADMIN_PORT = '5180', SERVER_PORT = '3000' } = loadEnv(mode, adminDirectory, ['ADMIN_PORT', 'SERVER_PORT'])
  const localServer = {
    host: '127.0.0.1',
    port: readPort('ADMIN_PORT', ADMIN_PORT),
    strictPort: true,
    proxy: { '/api/admin': `http://127.0.0.1:${readPort('SERVER_PORT', SERVER_PORT)}` },
  }
  return {
    plugins: [vue()],
    server: { ...localServer, fs: { allow: [adminDirectory, brandDirectory, plantDirectory, iconDirectory] } },
    preview: localServer,
  }
})
