#!/usr/bin/env node
// 一键发版：同步版本号 → 构建门禁 → 提交推送 → 打 tag 触发 GitHub Actions 打包发布
//
// 用法：
//   pnpm release 0.2.0        # 发新版本：四处版本号统一改为 0.2.0，走完整流程
//   pnpm release              # 版本号已手动改好、只补打 tag（校验四处一致后才放行）
//   任意用法加 --dry-run：只做检查并预览版本号改动，随后还原，不碰 git
//
// 四处版本号：package.json / src-tauri/tauri.conf.json / src-tauri/Cargo.toml / src-tauri/Cargo.lock（本包条目）。
// Rust 侧编译由 CI 验证，本脚本只跑 pnpm build（前端类型检查 + 构建门禁）。
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

const FILES = ['package.json', 'src-tauri/tauri.conf.json', 'src-tauri/Cargo.toml', 'src-tauri/Cargo.lock']
const LOCK_BLOCK = /name = "plant-pet"\nversion = "[^"]+"/

const die = (msg) => {
  console.error(`✗ ${msg}`)
  process.exit(1)
}
const run = (cmd, args) => {
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32' })
  if (r.status !== 0) die(`${cmd} ${args.join(' ')} 失败`)
}
const capture = (cmd, args) => {
  const r = spawnSync(cmd, args, { encoding: 'utf8', shell: process.platform === 'win32' })
  if (r.status !== 0) die(`${cmd} ${args.join(' ')} 失败`)
  return r.stdout.trim()
}

function readVersions() {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8')).version
  const conf = JSON.parse(readFileSync('src-tauri/tauri.conf.json', 'utf8')).version
  const toml = readFileSync('src-tauri/Cargo.toml', 'utf8').match(/^version = "([^"]+)"/m)?.[1]
  const lock = readFileSync('src-tauri/Cargo.lock', 'utf8').match(LOCK_BLOCK)?.[0]?.match(/version = "([^"]+)"/)?.[1]
  if (!toml) die('Cargo.toml 里没找到 [package] 的 version 行')
  if (!lock) die('Cargo.lock 里没找到 plant-pet 条目的 version 行')
  return { 'package.json': pkg, 'tauri.conf.json': conf, 'Cargo.toml': toml, 'Cargo.lock': lock }
}

// 逐文件替换；正则没命中直接中止，不允许静默跳过
function bumpVersions(version) {
  const patch = (file, re, to) => {
    const before = readFileSync(file, 'utf8')
    if (!re.test(before)) die(`${file} 没匹配到版本行，中止（所有文件均未修改）`)
    writeFileSync(file, before.replace(re, to))
  }
  patch('package.json', /"version": "[^"]+"/, `"version": "${version}"`)
  patch('src-tauri/tauri.conf.json', /"version": "[^"]+"/, `"version": "${version}"`)
  patch('src-tauri/Cargo.toml', /^version = "[^"]+"/m, `version = "${version}"`)
  patch('src-tauri/Cargo.lock', LOCK_BLOCK, `name = "plant-pet"\nversion = "${version}"`)
}

function preflight(tag) {
  if (capture('git', ['rev-parse', '--abbrev-ref', 'HEAD']) !== 'main') die('请在 main 分支上发版')
  // 只拦已跟踪文件的未提交改动；untracked 文件不会进发版提交，不挡路
  if (capture('git', ['status', '--porcelain', '--untracked-files=no']) !== '') die('工作区不干净，先提交或暂存（发版不代管无关改动）')
  run('git', ['fetch', 'origin', 'main', '--quiet'])
  if (capture('git', ['rev-list', '--count', 'HEAD..origin/main']) !== '0') die('本地 main 落后远端，先 git pull --ff-only')
  if (capture('git', ['tag', '-l', tag]) !== '') die(`tag ${tag} 本地已存在`)
  if (capture('git', ['ls-remote', '--tags', 'origin', `refs/tags/${tag}`]) !== '') die(`tag ${tag} 远端已存在`)
}

// —— 主流程 ——

if (!existsSync('src-tauri/tauri.conf.json')) die('请在仓库根目录运行')

const argv = process.argv.slice(2)
const dryRun = argv.includes('--dry-run')
const versionArg = argv.find((a) => a !== '--dry-run')
let target
if (versionArg !== undefined) {
  target = versionArg.replace(/^v/, '')
  if (!/^\d+\.\d+\.\d+$/.test(target)) die(`版本号 ${versionArg} 不合法，需要 x.y.z 格式`)
} else {
  target = JSON.parse(readFileSync('src-tauri/tauri.conf.json', 'utf8')).version
}
const tag = `v${target}`

const versions = readVersions()
console.log(`目标版本 ${target}${dryRun ? '（dry-run，不会产生任何变更）' : ''}`)
for (const [file, v] of Object.entries(versions)) {
  console.log(`  ${file}: ${v}${v === target ? '' : ` → ${target}`}`)
}

preflight(tag)

const originals = Object.fromEntries(FILES.map((f) => [f, readFileSync(f, 'utf8')]))
bumpVersions(target)
const changed = FILES.filter((f) => readFileSync(f, 'utf8') !== originals[f])

if (dryRun) {
  for (const f of FILES) {
    if (originals[f] !== readFileSync(f, 'utf8')) {
      console.log(`[dry-run] 将改写 ${f}`)
    }
  }
  for (const f of FILES) writeFileSync(f, originals[f])
  if (changed.length === 0) console.log('[dry-run] 四处版本号已一致，将只补打 tag')
  console.log(`[dry-run] 结束，文件已还原；正式执行：pnpm release ${target}`)
  process.exit(0)
}

if (changed.length > 0) {
  const r = spawnSync('pnpm', ['build'], { stdio: 'inherit', shell: process.platform === 'win32' })
  if (r.status !== 0) {
    spawnSync('git', ['checkout', '--', ...FILES])
    die('pnpm build 未通过，版本号改动已还原')
  }
  run('git', ['add', ...FILES])
  run('git', ['commit', '-m', `发布 v${target}`])
  run('git', ['push', 'origin', 'main'])
} else {
  console.log('四处版本号已一致，跳过改动与构建门禁，直接补打 tag')
}

run('git', ['tag', tag])
run('git', ['push', 'origin', tag])

const repo = capture('git', ['remote', 'get-url', 'origin']).match(/github\.com[:/](.+?)(?:\.git)?$/)?.[1]
console.log(`\n✓ ${tag} 已推送，Actions 开始三平台打包`)
if (repo) {
  console.log(`  进度：https://github.com/${repo}/actions`)
  console.log(`  构建完成后到 https://github.com/${repo}/releases 发布草稿`)
}
