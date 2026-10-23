#!/usr/bin/env node
/**
 * sprite-studio —— 植物素材生图自动化（图生图 ark | zeakai 可切，文案恒走火山方舟 Ark）
 * 设计文档：docs/生图自动化脚本设计.md（流程：ask → gen(idle) → 目测定稿 → gen(衍生帧) → commit）
 *
 * 子命令：
 *   probe                            探测生图/文本接口真实行为 → assets-src/_probe.json
 *   ask <物种名或一句描述> [--write]   AI 起草物种文案 → scripts/sprite-species.json
 *   gen --species <code> [--frames idle,happy,…] [--n 4] [--dry-run] [--ref <路径>]
 *                                    生成候选图 → assets-src/<dir>/_gen/<帧>/
 *   commit --species <code> [--write] 定稿入库：规范化 + map.json + 切图 + species.ts 片段
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, copyFileSync } from 'node:fs'
import { resolve, dirname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { deflateSync } from 'node:zlib'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SRC_DIR = resolve(ROOT, 'assets-src')
const PROBE_FILE = resolve(SRC_DIR, '_probe.json')
const SPECIES_FILE = resolve(ROOT, 'scripts/sprite-species.json')
const PROMPTS_FILE = resolve(ROOT, 'scripts/sprite-prompts.json')
const SPECIES_TS = resolve(ROOT, 'src/config/species.ts')

const ARK_BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3' // 图生图 + 文本
const ZEAKAI_DEFAULT_BASE_URL = 'https://zeakai-api.api4midjourney.com' // zeakai 中转站（图生图，OpenAI 兼容 /v1/images/edits）
const CHAT_MODEL = 'doubao-seed-2-1-lite-260915'
const IMAGE_TIMEOUT_MS = 120000
const CHAT_TIMEOUT_MS = 120000 // doubao 带思考链时可能超 60s
const FRAME_KEYS = ['idle', 'happy', 'thirsty', 'water', 'sun', 'sleep']
const BACKOFF_MS = [2000, 4000, 8000]

// ---------- 基础工具 ----------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const log = (...a) => console.log(...a)
const warn = (...a) => console.warn('⚠ ', ...a)
const die = (msg) => {
  console.error('✗', msg)
  process.exit(1)
}

function parseArgs(argv) {
  const out = { _: [], flags: {} }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith('--')) {
      const key = a.slice(2)
      const eq = key.indexOf('=')
      if (eq >= 0) {
        out.flags[key.slice(0, eq)] = key.slice(eq + 1)
        continue
      }
      const next = argv[i + 1]
      if (next !== undefined && !next.startsWith('--')) {
        out.flags[key] = next
        i++
      } else out.flags[key] = true
    } else out._.push(a)
  }
  return out
}

// .env 零依赖解析（不覆盖已有环境变量）
const envFile = resolve(ROOT, '.env')
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/)
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}
function requireKey() {
  const key = process.env.ARK_API_KEY
  if (!key) die('缺少 ARK_API_KEY：到火山方舟控制台（console.volcengine.com/ark）创建 API Key，写入仓库根 .env')
  return key
}

// ---------- 最小 PNG 编解码（与 process-sprites.mjs 同源的零依赖实现） ----------
const CRC_TABLE = new Uint32Array(256)
for (let n = 0; n < 256; n++) {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  CRC_TABLE[n] = c >>> 0
}
function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = (CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)) >>> 0
  return (c ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const typeBuf = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])))
  return Buffer.concat([len, typeBuf, data, crc])
}
function encodePng(rgba, width, height) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  const stride = width * 4
  const raw = Buffer.alloc((stride + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ])
}
function readPngSize(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('不是 PNG 文件')
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) }
}
const solidWhitePng = (size) => encodePng(Buffer.alloc(size * size * 4, 255), size, size)

// ---------- API ----------
function loadProbe() {
  if (!existsSync(PROBE_FILE)) return null
  try {
    return JSON.parse(readFileSync(PROBE_FILE, 'utf8'))
  } catch {
    return null
  }
}

async function callApi(url, init, { auth, timeoutMs = IMAGE_TIMEOUT_MS, label = url, authHint = '请检查 Authorization 配置' }) {
  for (let attempt = 1; ; attempt++) {
    let res
    try {
      res = await fetch(url, {
        ...init,
        headers: { ...init.headers, Authorization: auth },
        signal: AbortSignal.timeout(timeoutMs)
      })
    } catch (e) {
      if (attempt > BACKOFF_MS.length) die(`${label} 网络错误（重试 ${attempt - 1} 次后放弃）：${e.cause?.code || e.message}`)
      warn(`${label} 网络错误（${e.cause?.code || e.message}），${BACKOFF_MS[attempt - 1] / 1000}s 后重试`)
      await sleep(BACKOFF_MS[attempt - 1])
      continue
    }
    if (res.status === 401 || res.status === 403) throw new Error(`HTTP ${res.status} 鉴权失败：${authHint}`)
    if (res.status === 429 || res.status >= 500) {
      if (attempt > BACKOFF_MS.length) die(`${label} HTTP ${res.status}（重试 ${attempt - 1} 次后放弃）`)
      warn(`${label} HTTP ${res.status}，${BACKOFF_MS[attempt - 1] / 1000}s 后重试`)
      await sleep(BACKOFF_MS[attempt - 1])
      continue
    }
    const text = await res.text()
    let json = null
    try {
      json = JSON.parse(text)
    } catch {
      /* 保留原文用于报错 */
    }
    if (!res.ok) {
      const msg = json?.error?.message || json?.message || text.slice(0, 200)
      throw new Error(`HTTP ${res.status}：${msg}`)
    }
    return json
  }
}

// 火山方舟 Responses 形请求体：system 走 instructions，其余消息进 input；json_object 用 text.format
function chatBody(messages, jsonMode) {
  const hasSystem = messages[0]?.role === 'system'
  const system = hasSystem ? messages[0].content : null
  const rest = hasSystem ? messages.slice(1) : messages
  return {
    model: CHAT_MODEL,
    stream: false,
    thinking: { type: 'disabled' }, // 文案生成是结构化填空任务，不需要思考链（避免超时省 token）
    ...(system ? { instructions: system } : {}),
    input: rest.map((m) => ({ role: m.role, content: [{ type: 'input_text', text: m.content }] })),
    ...(jsonMode ? { text: { format: { type: 'json_object' } } } : {})
  }
}

// Responses 形响应取文本：跳过 reasoning 项，只拼 message.content[].text
function chatContent(json) {
  if (typeof json?.output_text === 'string' && json.output_text) return json.output_text
  let out = ''
  for (const item of Array.isArray(json?.output) ? json.output : []) {
    if (item?.type && item.type !== 'message') continue
    for (const c of Array.isArray(item?.content) ? item.content : []) {
      if (typeof c?.text === 'string') out += c.text
    }
  }
  if (out) return out
  return json?.choices?.[0]?.message?.content ?? ''
}

// 响应取图列表（OpenAI images 形 data[]：url | b64_json）
function extractImages(json) {
  const out = []
  for (const it of Array.isArray(json?.data) ? json.data : []) {
    if (!it) continue
    if (typeof it === 'string') out.push(/^https?:\/\//.test(it) ? { url: it } : { b64_json: it })
    else if (it.b64_json || it.b64) out.push({ b64_json: it.b64_json || it.b64 })
    else if (it.url || it.image_url) out.push({ url: it.url || it.image_url })
  }
  return out
}

// 从模型输出中剥出 JSON 主体
function stripFences(text) {
  const s = text.indexOf('{')
  const e = text.lastIndexOf('}')
  if (s >= 0 && e > s) return text.slice(s, e + 1)
  return text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '')
}

function loadSpeciesCfg() {
  if (!existsSync(SPECIES_FILE)) die(`缺少 ${SPECIES_FILE}`)
  return JSON.parse(readFileSync(SPECIES_FILE, 'utf8'))
}

// ---------- probe ----------
async function cmdProbe(args) {
  const key = requireKey()
  const target = resolveImageTarget(args, loadImageConfig())
  mkdirSync(SRC_DIR, { recursive: true })
  const result = {
    checkedAt: new Date().toISOString(),
    imageProvider: target.provider,
    imageModel: target.imageModel,
    imageSize: target.imageSize,
    chatModel: CHAT_MODEL
  }

  // —— 生图（当前供应商）：可用性 / 响应格式 ——
  result.image = { ok: false }
  try {
    log(`[probe] 生图接口（${target.provider}）：发送最小请求（1 张，会产生少量费用）…`)
    const prompt = 'a tiny green sprout in a clay pot, flat cartoon style'
    // 参考图白底：zeakai 用 512²（部分 edits 后端对输入图有最小尺寸要求），ark 64² 即可
    const { raw, items } = await requestImage(
      target,
      { prompt, refBuf: solidWhitePng(target.provider === 'zeakai' ? 512 : 64), label: '[probe/image]' }
    )
    try {
      writeFileSync(resolve(SRC_DIR, '_probe-raw.json'), JSON.stringify(raw, null, 2) + '\n')
    } catch {
      /* 存证失败不阻塞 */
    }
    result.imageResponseFormat = items[0].b64_json ? 'b64_json' : 'url'
    try {
      writeFileSync(resolve(SRC_DIR, '_probe-image.png'), await imageToPng(items[0], '[probe/image]'))
    } catch (e) {
      warn(`探测图落盘失败（不影响结论）：${e.message}`)
    }
    result.image.ok = true
  } catch (e) {
    result.imageError = e.message
    warn(`生图接口探测失败：${e.message}（继续探测文本接口）`)
  }

  // —— 文本（ark Responses API）：模型可用性 / json_object ——
  const arkAuth = { auth: `Bearer ${key}`, authHint: '请检查 .env 的 ARK_API_KEY 是否有效' }
  log('[probe] 文本接口（火山方舟 Ark）：发送最小请求…')
  const chatOnce = (jsonMode) =>
    callApi(
      `${ARK_BASE_URL}/responses`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(chatBody([{ role: 'user', content: '返回一个 JSON 对象：{"ok":true}' }], jsonMode))
      },
      { ...arkAuth, timeoutMs: CHAT_TIMEOUT_MS, label: '[probe/chat]' }
    )
  let chat = null
  let jsonMode = true
  try {
    chat = await chatOnce(true)
  } catch (e) {
    if (e.status === 400) {
      warn('text.format=json_object 被拒（400），退化为普通模式…')
      jsonMode = false
      chat = await chatOnce(false)
    } else {
      throw e
    }
  }
  let contentParses = false
  try {
    contentParses = JSON.parse(stripFences(chatContent(chat)))?.ok === true
  } catch {
    /* 记为 false */
  }
  result.chat = { model: CHAT_MODEL, jsonMode, contentParses }

  writeFileSync(PROBE_FILE, JSON.stringify(result, null, 2) + '\n')
  log('\n== probe 结论 ==')
  if (result.image.ok) {
    log(`  生图（${result.imageProvider}）: model=${result.imageModel} size=${result.imageSize}，响应格式=${result.imageResponseFormat}`)
    log('    探测图已存证 assets-src/_probe-image.png')
  } else {
    log(`  生图（${result.imageProvider}）: ✗ ${result.imageError || '未知原因'}`)
  }
  log(`  文本（Ark）         : ${CHAT_MODEL} 可用（json_object=${jsonMode ? '支持' : '不支持'}，样例可解析=${contentParses}）`)
  log(`  结论已写 ${PROBE_FILE}`)
}

// ---------- ask ----------
function validateDraft(j) {
  const bad = (m) => {
    throw new Error(m)
  }
  if (!j || typeof j !== 'object' || Array.isArray(j)) bad('不是 JSON 对象')
  if (!/^[a-z][a-z0-9-]*$/.test(j.code || '')) bad(`code 非法："${j.code}"（需英文小写/数字/中划线）`)
  for (const k of ['dir', 'name', 'desc', 'emoji']) {
    if (typeof j[k] !== 'string' || !j[k].trim()) bad(`缺少 ${k}`)
  }
  const st = j.states || {}
  for (const f of FRAME_KEYS) {
    if (typeof st[f] !== 'string' || !st[f].trim()) bad(`states.${f} 缺失或为空`)
  }
  return j
}

async function cmdAsk(args) {
  const key = requireKey()
  const phrase = args._.slice(1).join(' ').trim()
  if (!phrase) die('用法：pnpm sprite ask <物种名或一句描述> [--write] [--force]')
  const cfg = loadSpeciesCfg()
  const probeCfg = loadProbe()
  if (probeCfg?.chat?.jsonMode === false) warn('probe 结论：Ark 不支持 json_object，将用普通模式 + 围栏剥离')
  const jsonMode = probeCfg?.chat?.jsonMode !== false

  const examples = Object.entries(cfg.species)
    .map(([code, s]) => `  {"code":"${code}","name":"${s.name}","desc":"${s.desc}"${s.states ? `,"states覆盖":${JSON.stringify(s.states)}` : ''}}`)
    .join('\n')
  const system = `你是「芽伴 · Sproutkin」项目的素材文案助手。角色由 AI 生图产出，使用固定六段式提示词：[风格段]Q版卡通+游戏精灵立绘+粗黑描边+平涂糖果色+赛璐璐阴影；[载体段]陶土色圆形花盆作为身体+大圆眼睛+微笑嘴+粉腮红+小手小脚；[物种段]头顶植物特征；[构图段]正面全身构图，画面居中；[背景段]纯白色背景，单一角色，无文字，无水印；[质量段]高清细节。

风格段与载体段已锁定，你只负责为【一个新物种】产出物种段描述（desc）与 6 条状态句（states）。要求：
1. desc 一句话、具象可直接画，写清植物器官的形状/颜色/质感/姿态。
2. states 六条短句，语义固定：idle=平静基础态；happy=开心；thirsty=缺水蔫了；water=正被浇水、很幸福；sun=晒太阳（能开花的物种可写头顶开花）；sleep=睡着。描述必须落在该物种自己的器官上（多肉缺水是叶瓣发皱，薰衣草缺水是花穗下垂）。
3. 有刺/尖/毛的物种，desc 必须加"防画凶"限定（参考仙人球："浅色小软刺（刺极短极软）"）。
4. code 用英文小写+中划线；dir 为中文目录名（通常等于中文名）；emoji 选一个贴合的。

已入库物种示例（学习写法风格）：
${examples}

只输出一个 JSON 对象，不要 markdown 代码块、不要解释：
{"code":"…","dir":"…","name":"中文名","emoji":"…","desc":"…","states":{"idle":"…","happy":"…","thirsty":"…","water":"…","sun":"…","sleep":"…"}}`

  const messages = [
    { role: 'system', content: system },
    { role: 'user', content: phrase }
  ]
  log(`[ask] 调用 ${CHAT_MODEL}（json_object=${jsonMode ? '开' : '关'}）…`)
  const chatOnce = (jm) =>
    callApi(
      `${ARK_BASE_URL}/responses`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(chatBody(messages, jm))
      },
      { auth: `Bearer ${key}`, authHint: '请检查 .env 的 ARK_API_KEY 是否有效', timeoutMs: CHAT_TIMEOUT_MS, label: '[ask/chat]' }
    )
  let draft = null
  let lastErr = null
  let jsonModeNow = jsonMode
  for (let i = 0; i < 3 && !draft; i++) {
    let chat
    try {
      chat = await chatOnce(jsonModeNow)
    } catch (e) {
      if (e.status === 400 && jsonModeNow) {
        warn('text.format=json_object 被拒（400），退化普通模式重试…')
        jsonModeNow = false
        continue
      }
      throw e
    }
    const content = chatContent(chat)
    try {
      draft = validateDraft(JSON.parse(stripFences(content)))
    } catch (e) {
      lastErr = e
      messages.push({ role: 'user', content: `你上一次的输出不合规（${e.message}）。请重新只输出一个合规的 JSON 对象，不要任何解释或代码块。` })
    }
  }
  if (!draft) die(`AI 文案多次都不合规：${lastErr?.message}`)

  log('\n== 物种文案草稿（人工过目）==')
  log(JSON.stringify(draft, null, 2))
  if (!args.flags.write) {
    log('\n过目无误后，追加 --write 重新执行同一条命令即可写入 scripts/sprite-species.json')
    return
  }
  if (cfg.species[draft.code] && !args.flags.force) die(`物种 "${draft.code}" 已存在，确要覆盖请加 --force`)
  cfg.species[draft.code] = { dir: draft.dir, name: draft.name, emoji: draft.emoji, desc: draft.desc, states: draft.states }
  writeFileSync(SPECIES_FILE, JSON.stringify(cfg, null, 2) + '\n')
  log(`[ask] 已写入 ${SPECIES_FILE}`)
  log(`下一步：pnpm sprite gen --species ${draft.code}   # 先只生成 idle 主形象`)
}

// ---------- gen ----------
// 图生图通道适配表 + 统一出图出口：供应商差异全部收口在这里，gen / probe 只调 requestImage / generateImages。
// 新增供应商 = 加一个通道条目（endpoint / buildInit / resolve 认证），调用侧零改动。
//   ark    火山方舟 JSON /images/generations（正式出图，质量与已入库素材同源）
//   zeakai OpenAI 兼容中转站 multipart /v1/images/edits（开发期省成本；URL/Authorization 在 .env）
const IMAGE_PROVIDER_DEFAULTS = {
  ark: { imageModel: 'doubao-seedream-5-0-flash-260915', imageSize: '1024x1024' },
  zeakai: { imageModel: 'gpt-image-2.5-sunburst', imageSize: '1024x1024' }
}

const IMAGE_CHANNELS = {
  ark: {
    endpoint: '/images/generations',
    buildInit: (t, { prompt, refBuf }) => ({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: t.imageModel,
        prompt,
        image: `data:image/png;base64,${refBuf.toString('base64')}`,
        response_format: 'url',
        size: t.imageSize,
        stream: false,
        watermark: false, // 默认 true，必须显式关
        output_format: 'png' // 默认 jpeg，下游切图管线只认 PNG
      })
    }),
    resolve: () => ({
      base: ARK_BASE_URL,
      auth: `Bearer ${requireKey()}`,
      authHint: '请检查 .env 的 ARK_API_KEY 是否有效'
    })
  },
  zeakai: {
    endpoint: '/v1/images/edits',
    // multipart：Authorization 用 .env 配置原文（无 Bearer 前缀）；Content-Type 交给 fetch 自动带 boundary
    buildInit: (t, { prompt, refBuf }) => {
      const form = new FormData()
      form.append('image', new Blob([refBuf], { type: 'image/png' }), 'ref.png')
      form.append('prompt', prompt)
      form.append('model', t.imageModel)
      form.append('n', '1')
      form.append('size', t.imageSize)
      if (t.quality) form.append('quality', String(t.quality))
      return { method: 'POST', headers: {}, body: form }
    },
    resolve: () => {
      const auth = process.env.ZEAKAI_AUTHORIZATION
      if (!auth) die('缺少 ZEAKAI_AUTHORIZATION：仓库根 .env 配中转站的 Authorization 原文（zeakai 文档示例无 Bearer 前缀）；非默认站还需 ZEAKAI_BASE_URL')
      return {
        base: String(process.env.ZEAKAI_BASE_URL || ZEAKAI_DEFAULT_BASE_URL).replace(/\/+$/, ''),
        auth,
        authHint: '请检查 .env 的 ZEAKAI_AUTHORIZATION / ZEAKAI_BASE_URL'
      }
    }
  }
}

function loadImageConfig() {
  const file = resolve(ROOT, 'scripts/sprite-config.json')
  const cfg = {}
  if (existsSync(file)) {
    try {
      Object.assign(cfg, JSON.parse(readFileSync(file, 'utf8')))
    } catch (e) {
      die(`解析 ${file} 失败：${e.message}`)
    }
  }
  return {
    imageProvider: cfg.imageProvider || 'ark',
    // 兼容旧配置的顶层 imageModel/imageSize（原 ark 单供应商写法）
    ark: {
      ...IMAGE_PROVIDER_DEFAULTS.ark,
      imageModel: cfg.imageModel || IMAGE_PROVIDER_DEFAULTS.ark.imageModel,
      imageSize: cfg.imageSize || IMAGE_PROVIDER_DEFAULTS.ark.imageSize,
      ...cfg.ark
    },
    zeakai: { ...IMAGE_PROVIDER_DEFAULTS.zeakai, ...cfg.zeakai }
  }
}

// 本次生效的图生图通道：--provider 临时覆盖 > sprite-config.json imageProvider > ark
function resolveImageTarget(args, imgCfg) {
  const provider = String(args.flags.provider || imgCfg.imageProvider || 'ark').toLowerCase()
  const channel = IMAGE_CHANNELS[provider]
  if (!channel) die(`未知图生图供应商 "${provider}"（可选 ${Object.keys(IMAGE_CHANNELS).join(' / ')}）`)
  return { provider, endpoint: channel.endpoint, ...imgCfg[provider], ...channel.resolve() }
}

const FRAME_LABELS = { idle: '平静基础态', happy: '开心', thirsty: '缺水蔫了', water: '被浇水很幸福', sun: '晒太阳', sleep: '熟睡' }

function buildPrompt(prompts, sp, frame) {
  const segs = [prompts.style, prompts.carrier, `头顶${sp.desc}`, prompts.compose, prompts.background, prompts.qualityTail].join('，')
  if (frame === 'idle') {
    // idle 的参考图是别的物种，必须显式要求"换头"，防止参考图植物残留
    return `保持与参考图完全相同的陶土花盆角色造型与画风，仅把头顶植物替换为：${sp.desc}，不要出现参考图中的植物。${segs}。状态：平静微笑，自然站立`
  }
  // seedream 图生图对参考图服从性很强：衍生帧必须把"脸表情"和"植物状态"拆成两处显式变化，
  // 只写植物状态（如 ask 产出的句子）会导致脸完全不变、帧间无差异
  const face = prompts.faces?.[frame]
  const plantState = sp.states?.[frame] || prompts.states?.[frame] || ''
  const changes = [
    face ? `1. 花盆脸的表情：${face}` : null,
    plantState ? `2. 头顶植物的状态：${plantState}` : null
  ].filter(Boolean)
  return [
    `参考图是这只陶土花盆角色的平静状态。请生成它【${FRAME_LABELS[frame]}】的状态，与参考图相比必须有明显可见的变化：`,
    ...changes,
    `除以上变化外，其余与参考图保持完全一致：同一只陶土花盆角色，造型、大小、居中构图、纯白色背景不变，头顶${sp.desc}的物种特征不变。`,
    prompts.style
  ].join('\n')
}

// 出图响应统一守卫：zeakai 业务信封（HTTP 200）——错误形 {"code":1003,"description":"…","result":null}，成功可能把 data 包在 result 里
function imagesFromResponse(json, label) {
  const hasImages = Array.isArray(json?.data) || Array.isArray(json?.result?.data)
  if (json?.error || (!hasImages && json?.code !== undefined)) {
    const msg = json.error?.message || json.description || JSON.stringify(json.error || json).slice(0, 200)
    throw new Error(`${label} HTTP 200 业务报错信封：${msg}`)
  }
  const data = Array.isArray(json?.data) ? json.data : json?.result?.data
  const one = data ? extractImages({ data }) : []
  if (!one.length) throw new Error(`${label} 响应解析不出图片：${JSON.stringify(json).slice(0, 200)}`)
  return one
}

// —— 生图统一出口（gen / probe 唯一入口，供应商差异全部封在 IMAGE_CHANNELS）——

// 单次请求：按当前通道发一个请求，守卫解析出图片条目；原始响应带回供 probe 存证
async function requestImage(target, { prompt, refBuf, label }) {
  const raw = await callApi(
    `${target.base}${target.endpoint}`,
    IMAGE_CHANNELS[target.provider].buildInit(target, { prompt, refBuf }),
    { auth: target.auth, timeoutMs: IMAGE_TIMEOUT_MS, label, authHint: target.authHint }
  )
  return { raw, items: imagesFromResponse(raw, label) }
}

// 图片条目 → PNG Buffer（b64 解码 / url 下载），校验魔数（切图管线只认 PNG）
async function imageToPng(item, label) {
  let buf
  if (item?.b64_json) {
    buf = Buffer.from(item.b64_json, 'base64')
  } else if (item?.url) {
    const r = await fetch(item.url, { signal: AbortSignal.timeout(60000) })
    if (!r.ok) throw new Error(`${label} 图片下载失败 HTTP ${r.status}`)
    buf = Buffer.from(await r.arrayBuffer())
  } else {
    throw new Error(`${label} 未知图片条目：${JSON.stringify(item).slice(0, 120)}`)
  }
  if (buf.readUInt32BE(0) !== 0x89504e47) {
    throw new Error(`${label} 返回内容不是 PNG（切图管线只认 PNG）；请检查供应商/模型的出图格式`)
  }
  return buf
}

// 顶层封装：n 张候选一次拿全（各通道均按 1 张/请求串行：ark 无 n 参数；zeakai 中转站 n 行为不稳），已校验为 PNG Buffer
async function generateImages(target, { prompt, refPath, n }) {
  const refBuf = readFileSync(refPath)
  const out = []
  for (let i = 0; i < n; i++) {
    const label = `[image ${i + 1}/${n}]`
    const { items } = await requestImage(target, { prompt, refBuf, label })
    for (const item of items) out.push(await imageToPng(item, label))
  }
  return out
}

function nextIndex(dir, frame) {
  if (!existsSync(dir)) return 0
  let max = 0
  for (const f of readdirSync(dir)) {
    const m = f.match(new RegExp(`^${frame}-(\\d+)\\.png$`))
    if (m) max = Math.max(max, Number(m[1]))
  }
  return max
}

function manifestAppend(genDir, record) {
  const file = resolve(genDir, 'manifest.json')
  let data = { records: [] }
  try {
    if (existsSync(file)) data = JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    warn('manifest.json 解析失败，重新开始记录')
  }
  data.records.push(record)
  writeFileSync(file, JSON.stringify(data, null, 2) + '\n')
}

async function cmdGen(args) {
  const code = args.flags.species
  if (!code) die('用法：pnpm sprite gen --species <code> [--all] [--frames idle,happy,…] [--n 1] [--dry-run] [--ref 路径]')
  const cfg = loadSpeciesCfg()
  const sp = cfg.species[code]
  if (!sp) die(`sprite-species.json 中没有 "${code}"；新物种先跑：pnpm sprite ask <物种名> --write`)
  const all = !!args.flags.all
  if (all && args.flags.frames) warn('--all 已包含全部 6 帧，忽略 --frames')
  const frames = all ? [...FRAME_KEYS] : (args.flags.frames ? String(args.flags.frames).split(',') : ['idle']).map((s) => s.trim()).filter(Boolean)
  for (const f of frames) if (!FRAME_KEYS.includes(f)) die(`未知帧 "${f}"，可选：${FRAME_KEYS.join(',')}`)
  const n = Math.max(1, Math.min(6, Number(args.flags.n) || 1)) // 出图质量稳定，默认每帧 1 张控制成本
  const target = resolveImageTarget(args, loadImageConfig())

  const idleFinal = resolve(SRC_DIR, sp.dir, '_gen', 'idle', 'idle-FINAL.png')
  // --all 模式下衍生帧直接参考本次新生成的 idle 候选，免除人工 FINAL 定稿步骤（目检闸门仍在 commit 之前由人工执行）
  const needsFinal = !all && frames.some((f) => f !== 'idle')
  if (needsFinal && !existsSync(idleFinal)) {
    die(`缺少定稿参考图 ${idleFinal}\n请先目检 _gen/idle/ 的候选，把选中那张复制为 idle-FINAL.png（或改用 --all 一键生成），再生成衍生帧。`)
  }
  const idleRef = args.flags.ref ? resolve(ROOT, String(args.flags.ref)) : resolve(ROOT, cfg.defaultRef)
  if (frames.includes('idle') && !existsSync(idleRef)) {
    die(`风格参考图不存在：${idleRef}\nassets-src 仅存于本机（已 gitignore）；确认文件还在，或在 sprite-species.json 的 defaultRef 指向一张已定稿白底原图。`)
  }

  const prompts = JSON.parse(readFileSync(PROMPTS_FILE, 'utf8'))
  const genDir = resolve(SRC_DIR, sp.dir, '_gen')
  let freshIdleRef = null

  for (const frame of frames) {
    const prompt = buildPrompt(prompts, sp, frame)
    const refPath = frame === 'idle' ? idleRef : all ? freshIdleRef : idleFinal
    if (frame !== 'idle' && !refPath && !args.flags['dry-run']) die('内部错误：缺少 idle 参考图，请重跑')
    if (args.flags['dry-run']) {
      log(`\n[dry-run] frame=${frame} ref=${refPath || '(--all：用本次新生成的 idle 候选)'}`)
      log(`  POST ${target.base}${target.endpoint}  provider=${target.provider} model=${target.imageModel} n=${n} size=${target.imageSize}${target.quality ? ` quality=${target.quality}` : ''}`)
      log(`  prompt: ${prompt}`)
      continue
    }
    log(`\n[gen] ${frame}：${target.provider}/${target.imageModel} 请求 ${n} 张候选（参考图 ${basename(refPath)}）…`)
    const t0 = Date.now()
    const buffers = await generateImages(target, { prompt, refPath, n })
    const outDir = resolve(genDir, frame)
    mkdirSync(outDir, { recursive: true })
    let idx = nextIndex(outDir, frame)
    const ms = Date.now() - t0
    let firstSaved = null
    for (const buf of buffers) {
      const file = `${frame}-${++idx}.png`
      const filePath = resolve(outDir, file)
      writeFileSync(filePath, buf)
      if (frame === 'idle' && !firstSaved) firstSaved = filePath
      manifestAppend(genDir, {
        finishedAt: new Date().toISOString(),
        frame,
        file,
        prompt,
        ref: refPath,
        provider: target.provider,
        model: target.imageModel,
        size: target.imageSize,
        n,
        ms,
        sha256: createHash('sha256').update(buf).digest('hex').slice(0, 16),
        bytes: buf.length
      })
      log(`  ✓ ${frame}/${file}（${(buf.length / 1024) | 0}KB）`)
    }
    if (frame === 'idle' && firstSaved) freshIdleRef = firstSaved
  }

  if (args.flags['dry-run']) return
  if (existsSync(genDir) && process.platform === 'darwin') spawnSync('open', [genDir], { stdio: 'ignore' })
  log('\n== 下一步 ==')
  if (all) {
    log(`  1. 目检 ${genDir}/ 下 6 帧；不满意的帧单独重生成：pnpm sprite gen --species ${code} --frames <帧>`)
    log(`  2. 满意后直接入库（唯一候选免 FINAL；多候选需复制选中图为 <帧>-FINAL.png）：pnpm sprite commit --species ${code}`)
  } else {
    if (frames.includes('idle')) log(`  1. 目检 ${genDir}/idle/，把选中候选复制为 idle-FINAL.png`)
    if (needsFinal || frames.includes('idle'))
      log(`  2. 生成衍生帧：pnpm sprite gen --species ${code} --all   # 或 --frames 逐帧生成`)
    log('  3. 逐帧定稿后入库：pnpm sprite commit --species ' + code)
  }
}

// ---------- commit ----------
async function cmdCommit(args) {
  const code = args.flags.species
  if (!code) die('用法：pnpm sprite commit --species <code> [--write]')
  const cfg = loadSpeciesCfg()
  const sp = cfg.species[code]
  if (!sp) die(`sprite-species.json 中没有 "${code}"`)
  const dir = resolve(SRC_DIR, sp.dir)

  const missing = []
  const finals = {}
  for (const f of FRAME_KEYS) {
    const p = resolve(dir, '_gen', f, `${f}-FINAL.png`)
    if (existsSync(p)) {
      finals[f] = p
      continue
    }
    // 无 FINAL 时：唯一候选直接采用（人工触发 commit 即目检通过）；多候选必须显式定稿
    const frameDir = resolve(dir, '_gen', f)
    const candidates = existsSync(frameDir)
      ? readdirSync(frameDir).filter((x) => new RegExp(`^${f}-(\\d+)\\.png$`).test(x)).sort((a, b) => Number(a.match(/(\d+)/)[1]) - Number(b.match(/(\d+)/)[1]))
      : []
    if (candidates.length === 1) {
      finals[f] = resolve(frameDir, candidates[0])
      log(`[commit] ${f}：无 FINAL，采用唯一候选 ${candidates[0]}`)
    } else {
      missing.push(candidates.length > 1 ? `${f}（${candidates.length} 张候选，请把选中的复制为 ${f}-FINAL.png）` : f)
    }
  }
  if (missing.length) die(`以下帧还没定稿：${missing.join('、')}`)

  const dims = Object.entries(finals).map(([f, p]) => ({ f, ...readPngSize(readFileSync(p)) }))
  log('[commit] FINAL 尺寸预检：' + dims.map((d) => `${d.f}=${d.width}x${d.height}`).join('  '))
  if (new Set(dims.map((d) => d.width)).size > 1 || new Set(dims.map((d) => d.height)).size > 1) {
    warn('各帧尺寸不一致；切图管线会归一到 400²，但请目检确认各帧构图主体大小接近（同锚点）')
  }

  const framesMap = {}
  for (const f of FRAME_KEYS) {
    const target = `${f}1.png`
    copyFileSync(finals[f], resolve(dir, target))
    framesMap[f] = target
  }
  const mapFile = resolve(dir, 'map.json')
  writeFileSync(mapFile, JSON.stringify({ species: code, frames: framesMap }, null, 2) + '\n')
  log(`[commit] 6 帧已规范化为 <帧>1.png，map.json 已写：${mapFile}`)

  log(`[commit] 运行切图管线 process-sprites.mjs（仅 ${code}，避免覆盖既有物种的人工修正帧）…`)
  const r = spawnSync(process.execPath, [resolve(ROOT, 'scripts/process-sprites.mjs'), code], { stdio: 'inherit' })
  if (r.status !== 0) die('切图失败，请看上方输出')

  const name = sp.name || sp.dir
  const emoji = sp.emoji || '🌱'
  const entry = `  ${code}: { code: '${code}', name: '${name}', emoji: '${emoji}', hue: 0, waterIntervalH: 72 /* TODO 按物种特性调整 */, sunIntervalH: 120 /* TODO 按物种特性调整 */, firstTaskDelayMin: 5 },`
  if (args.flags.write) {
    const ts = readFileSync(SPECIES_TS, 'utf8')
    const anchor = '\n}\n\nexport const SPECIES_LIST'
    if (ts.includes(`${code}: {`)) {
      warn(`species.ts 已有 ${code}，跳过插入`)
    } else if (!ts.includes(anchor)) {
      die('species.ts 结构与预期不符（找不到插入锚点），请手工添加条目')
    } else {
      writeFileSync(SPECIES_TS, ts.replace(anchor, `\n${entry}\n}\n\nexport const SPECIES_LIST`))
      log('[commit] 已插入 species.ts —— 养护参数是占位值（72/120），务必按物种特性人工调整！')
      log('         然后跑 pnpm typecheck，并打开领养页目测新物种卡片')
    }
  } else {
    log('\n[commit] 待人工粘贴到 src/config/species.ts 的 SPECIES（养护参数请按物种特性填写）：')
    log(entry)
  }

  log('\n[commit] 入库前验收清单（AI生图与切图管线.md §5）：')
  for (const line of [
    '同物种 6 帧齐全（idle/happy/thirsty/water/sun/sleep）',
    '同组帧同画布、同锚点（整体构图居中即可，管线已归一）',
    '抠图无白边残留、植株完整（叶片高光未被误删）',
    '色板一致（同一套主色，参考图机制保证）',
    '替换后跑 24h 常驻，内存无增长'
  ]) {
    log(`  - [ ] ${line}`)
  }
  log('\n完成。')
}

// ---------- 入口 ----------
function usage() {
  log(`sprite-studio —— 植物素材生图自动化（设计：docs/生图自动化脚本设计.md）

用法：
  pnpm sprite probe                          探测接口真实行为 → assets-src/_probe.json
  pnpm sprite ask <物种名或一句描述> [--write]  AI 起草物种文案 → scripts/sprite-species.json
  pnpm sprite gen --species <code> [--all] [--frames idle,happy,…] [--n 1] [--dry-run] [--ref 路径] [--provider ark|zeakai]
                                             生成候选图（--all 一键生成全部 6 帧）→ assets-src/<dir>/_gen/
  pnpm sprite commit --species <code> [--write]
                                             定稿入库：规范化 + map.json + 切图 + species.ts 片段

图生图供应商：scripts/sprite-config.json "imageProvider"（ark | zeakai），gen/probe 可用 --provider 临时覆盖
  ark    火山方舟 /images/generations，.env 配 ARK_API_KEY
  zeakai OpenAI 兼容中转站 /v1/images/edits（开发期省成本），.env 配 ZEAKAI_AUTHORIZATION（Authorization 原文，无 Bearer 前缀）
         + ZEAKAI_BASE_URL（缺省 https://zeakai-api.api4midjourney.com）；仅脚本侧支持，面板不接
文案（ask）恒走火山方舟 Ark；模型/尺寸在各供应商条目下配（zeakai 可选 quality）
流程：ask → gen --all（一键 6 帧，默认每帧 1 张）→ 目检 → commit → 验收清单；逐帧精修用 --frames + FINAL 定稿
`)
}

const args = parseArgs(process.argv.slice(2))
const cmd = args._[0]
try {
  if (cmd === 'probe') await cmdProbe(args)
  else if (cmd === 'ask') await cmdAsk(args)
  else if (cmd === 'gen') await cmdGen(args)
  else if (cmd === 'commit') await cmdCommit(args)
  else usage()
} catch (e) {
  console.error('✗', e.message)
  process.exit(1)
}
