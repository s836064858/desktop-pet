// 火山方舟 Ark 客户端：图生图 + 文案（Responses API），鉴权/重试/超时统一在这层
import { fetch as tauriFetch } from '@tauri-apps/plugin-http'

const ARK_BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3'
const BACKOFF_MS = [2000, 4000, 8000]
const IMAGE_TIMEOUT_MS = 120000
const CHAT_TIMEOUT_MS = 120000

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

interface ArkCallOptions {
  apiKey: string
  label?: string
}

async function arkPost(path: string, body: unknown, opts: ArkCallOptions, timeoutMs: number): Promise<unknown> {
  const label = opts.label ?? path
  for (let attempt = 1; ; attempt++) {
    let res: Response
    try {
      res = await tauriFetch(`${ARK_BASE_URL}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${opts.apiKey}` },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      })
    } catch (err) {
      if (attempt > BACKOFF_MS.length) throw new Error(`${label} 网络错误（重试后仍失败）：${String(err)}`)
      await sleep(BACKOFF_MS[attempt - 1])
      continue
    }
    if (res.status === 401 || res.status === 403) {
      throw new Error(`鉴权失败（HTTP ${res.status}）：请在 AI 弹窗中检查素材密钥`)
    }
    if (res.status === 429 || res.status >= 500) {
      if (attempt > BACKOFF_MS.length) throw new Error(`${label} HTTP ${res.status}（重试后仍失败）`)
      await sleep(BACKOFF_MS[attempt - 1])
      continue
    }
    const text = await res.text()
    let json: unknown = null
    try {
      json = JSON.parse(text)
    } catch {
      /* 保留原文用于报错 */
    }
    if (!res.ok) {
      const msg = (json as { error?: { message?: string }, message?: string } | null)?.error?.message
        ?? (json as { message?: string } | null)?.message
        ?? text.slice(0, 200)
      throw new Error(`HTTP ${res.status}：${msg}`)
    }
    return json
  }
}

// —— 文案（Responses API：system 走 instructions，关思考链，json_object 走 text.format）——

export interface ChatMessage {
  role: 'system' | 'user'
  content: string
}

function chatBody(model: string, messages: ChatMessage[], jsonMode: boolean): unknown {
  const hasSystem = messages[0]?.role === 'system'
  const system = hasSystem ? messages[0].content : null
  const rest = hasSystem ? messages.slice(1) : messages
  return {
    model,
    stream: false,
    thinking: { type: 'disabled' },
    ...(system ? { instructions: system } : {}),
    input: rest.map((m) => ({ role: m.role, content: [{ type: 'input_text', text: m.content }] })),
    ...(jsonMode ? { text: { format: { type: 'json_object' } } } : {}),
  }
}

export function chatContent(json: unknown): string {
  const obj = json as {
    output_text?: string
    output?: Array<{ type?: string, content?: Array<{ text?: string }> }>
    choices?: Array<{ message?: { content?: string } }>
  } | null
  if (typeof obj?.output_text === 'string' && obj.output_text) return obj.output_text
  let out = ''
  for (const item of Array.isArray(obj?.output) ? obj.output : []) {
    if (item?.type && item.type !== 'message') continue
    for (const c of Array.isArray(item?.content) ? item.content : []) {
      if (typeof c?.text === 'string') out += c.text
    }
  }
  if (out) return out
  return obj?.choices?.[0]?.message?.content ?? ''
}

const CHAT_MODEL = 'doubao-seed-2-1-lite-260915'

export async function arkChat(opts: ArkCallOptions & { messages: ChatMessage[], jsonMode: boolean }): Promise<string> {
  const json = await arkPost('/responses', chatBody(CHAT_MODEL, opts.messages, opts.jsonMode), opts, CHAT_TIMEOUT_MS)
  return chatContent(json)
}

// —— 图生图（seedream：Base64 参考图，无 n 参数一次一张）——

export const IMAGE_MODEL = 'doubao-seedream-5-0-flash-260915'
export const IMAGE_SIZE = '1024x1024'

export async function arkGenerateImage(opts: ArkCallOptions & {
  prompt: string
  refDataUrl: string
}): Promise<Uint8Array> {
  const json = (await arkPost(
    '/images/generations',
    {
      model: IMAGE_MODEL,
      prompt: opts.prompt,
      image: opts.refDataUrl,
      response_format: 'b64_json', // 直接内联返回，免去二次下载（TOS 图床域名不在 http capability 白名单内）
      size: IMAGE_SIZE,
      stream: false,
      watermark: false, // 默认 true，必须显式关
      output_format: 'png', // 默认 jpeg，切图管线只认 PNG
    },
    opts,
    IMAGE_TIMEOUT_MS,
  )) as { data?: Array<{ url?: string, b64_json?: string }> } | null
  const item = json?.data?.[0]
  if (item?.b64_json) {
    return base64ToBytes(item.b64_json)
  }
  if (item?.url) {
    const res = await tauriFetch(item.url, { method: 'GET', signal: AbortSignal.timeout(60000) })
    if (!res.ok) throw new Error(`图片下载失败 HTTP ${res.status}`)
    return new Uint8Array(await res.arrayBuffer())
  }
  throw new Error('生图响应解析不出图片')
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

export async function bytesToDataUrl(bytes: Uint8Array): Promise<string> {
  const blob = new Blob([bytes as BlobPart], { type: 'image/png' })
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error ?? new Error('读取图片失败'))
    reader.readAsDataURL(blob)
  })
}
