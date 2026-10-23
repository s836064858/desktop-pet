#!/usr/bin/env node
// DMG 内嵌安装说明：把 src-tauri/dmg/安装说明.txt 写进 dmg 根目录（Tauri 打包器不支持额外文件，故 hdiutil 后处理）。
// 仅 macOS；CI 在 tauri-action 上传后调用并用 gh release upload --clobber 重传，本地可直接跑用于自测。
// 用法：node scripts/add-dmg-notes.mjs <dmg 文件路径>
import { execSync, spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const die = (msg) => {
  console.error(`✗ ${msg}`)
  process.exit(1)
}
const run = (cmd, args) => {
  const r = spawnSync(cmd, args, { stdio: 'inherit' })
  if (r.status !== 0) die(`${cmd} ${args.join(' ')} 失败`)
}

const dmg = process.argv[2]
const notes = fileURLToPath(new URL('../src-tauri/dmg/安装说明.txt', import.meta.url))
if (!dmg || !existsSync(dmg)) die('用法：node scripts/add-dmg-notes.mjs <dmg 文件路径>')
if (process.platform !== 'darwin') die('仅 macOS 支持（依赖 hdiutil）')
if (!existsSync(notes)) die(`说明文件不存在：${notes}`)

const tmp = mkdtempSync(join(tmpdir(), 'dmg-notes-'))
try {
  const rw = join(tmp, 'rw.dmg')
  const out = join(tmp, 'out.dmg')
  run('hdiutil', ['convert', dmg, '-format', 'UDRW', '-o', rw])
  const mount = join(tmp, 'mnt')
  mkdirSync(mount)
  run('hdiutil', ['attach', rw, '-mountpoint', mount, '-nobrowse', '-noautoopen'])
  copyFileSync(notes, join(mount, '安装说明.txt'))
  // detach 偶发因后台索引占用而失败，重试一次
  const detach = spawnSync('hdiutil', ['detach', mount])
  if (detach.status !== 0) {
    execSync('sleep 2')
    run('hdiutil', ['detach', mount])
  }
  run('hdiutil', ['convert', rw, '-format', 'UDZO', '-o', out])
  copyFileSync(out, dmg)
  console.log(`✓ 安装说明已写入 ${dmg}`)
} finally {
  rmSync(tmp, { recursive: true, force: true })
}
