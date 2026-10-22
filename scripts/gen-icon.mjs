import { spawnSync } from 'node:child_process'
import { accessSync, copyFileSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const projectDir = fileURLToPath(new URL('../', import.meta.url))
const tauriDir = join(projectDir, 'src-tauri')
const config = JSON.parse(readFileSync(join(tauriDir, 'tauri.conf.json'), 'utf8'))

function renderIcons({ outputDir }) {
  const result = spawnSync(
    process.execPath,
    [
      require.resolve('@tauri-apps/cli/tauri.js'),
      'icon',
      join(projectDir, 'src/assets/brand/logo.png'),
      '--output',
      outputDir,
    ],
    { cwd: projectDir, stdio: 'inherit', timeout: 120_000 }
  )
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error('图标生成失败，现有图标未修改')
}

function generateDesktopIcons() {
  if (!Array.isArray(config.bundle?.icon) || config.bundle.icon.length === 0) {
    throw new Error('Tauri 配置中缺少桌面图标列表')
  }
  const outputDir = mkdtempSync(join(tmpdir(), 'sproutkin-icons-'))
  try {
    renderIcons({ outputDir })
    const icons = config.bundle.icon.map((iconPath) => ({
      source: join(outputDir, basename(iconPath)),
      target: join(tauriDir, iconPath),
    }))
    for (const { source } of icons) accessSync(source)
    for (const { source, target } of icons) copyFileSync(source, target)
    console.log(`已更新 ${icons.length} 个 macOS / Windows 桌面图标`)
  } finally {
    rmSync(outputDir, { recursive: true, force: true })
  }
}

try {
  generateDesktopIcons()
} catch (err) {
  console.error(`桌面图标生成失败：${err instanceof Error ? err.message : String(err)}`)
  process.exitCode = 1
}
