export const CHAT_MODEL = 'doubao-seed-2-1-lite-260915'
export const IMAGE_MODEL = 'doubao-seedream-5-0-flash-260915'
const arkOrigin = 'https://ark.cn-beijing.volces.com/api/v3'
const pngSignature = Buffer.from('89504e470d0a1a0a', 'hex')

export class ArkError extends Error {
  constructor(message: string, readonly result: 'failed' | 'unknown', readonly statusCode?: number) {
    super(message)
  }
}

interface ArkResponse {
  error?: unknown
  output_text?: string
  output?: { type: string; content?: { text?: string }[] }[]
  data?: { b64_json?: string }[]
  usage?: {
    input_tokens?: number
    output_tokens?: number
    input_tokens_details?: { cached_tokens?: number }
    generated_images?: number
  }
}

export interface ArkUsage {
  inputTokens: number | null
  outputTokens: number | null
  cachedInputTokens: number | null
  generatedImages: number | null
}

async function readJson(response: Response): Promise<ArkResponse> {
  const reader = response.body?.getReader()
  if (!reader) throw new ArkError('方舟未返回内容。', 'failed')
  const chunks: Buffer[] = []
  let size = 0
  try {
    for (;;) {
      const next = await reader.read()
      if (next.done) break
      size += next.value.length
      if (size > 28 * 1024 * 1024) throw new ArkError('方舟响应过大。', 'failed')
      chunks.push(Buffer.from(next.value))
    }
  } catch (error) {
    if (error instanceof ArkError) throw error
    throw new ArkError('方舟响应未传完，结果未知。', 'unknown')
  } finally {
    await reader.cancel().catch(() => undefined)
    reader.releaseLock()
  }
  try {
    const result = JSON.parse(Buffer.concat(chunks).toString('utf8')) as ArkResponse
    if (!result || typeof result !== 'object' || result.error) throw new Error()
    return result
  } catch {
    throw new ArkError('方舟响应格式异常。', 'failed')
  }
}

export async function arkRequest(options: {
  key: string; path: string; body?: object; signal?: AbortSignal; timeout?: number
}): Promise<ArkResponse> {
  const deadline = AbortSignal.timeout(options.timeout ?? 120_000)
  const signal = options.signal ? AbortSignal.any([options.signal, deadline]) : deadline
  let response: Response
  try {
    response = await fetch(arkOrigin + options.path, {
      method: options.body ? 'POST' : 'GET',
      headers: { Authorization: `Bearer ${options.key}`, 'Content-Type': 'application/json' },
      body: options.body && JSON.stringify(options.body), redirect: 'error', signal,
    })
  } catch {
    throw new ArkError('未收到方舟响应，结果未知；不会自动重发。', 'unknown')
  }
  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined)
    const statusCode = response.status
    throw new ArkError(`方舟请求未成功（HTTP ${statusCode}）。`, statusCode >= 500 ? 'unknown' : 'failed', statusCode)
  }
  return readJson(response)
}

function tokens(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 4294967295
    ? value : null
}

export function arkUsage(response?: ArkResponse): ArkUsage {
  const usage = response?.usage
  const inputTokens = tokens(usage?.input_tokens)
  const cache = tokens(usage?.input_tokens_details?.cached_tokens)
  return {
    inputTokens,
    outputTokens: tokens(usage?.output_tokens),
    cachedInputTokens: cache !== null && inputTokens !== null && cache <= inputTokens ? cache : null,
    generatedImages: tokens(usage?.generated_images),
  }
}

export function arkText(response: ArkResponse): string {
  const output = response.output_text || (Array.isArray(response.output) ? response.output : [])
    .filter((item) => item?.type === 'message' && Array.isArray(item.content))
    .flatMap((item) => item.content?.map((entry) => entry?.text ?? '') ?? []).join('')
  if (typeof output !== 'string' || !output.trim() || output.length > 16000) {
    throw new ArkError('方舟未返回有效的植物档案。', 'failed')
  }
  return output
}

export async function verifyArkChat(key: string): Promise<void> {
  const response = await arkRequest({
    key,
    path: '/responses',
    timeout: 12_000,
    body: {
      model: CHAT_MODEL,
      input: 'Reply with OK.',
      thinking: { type: 'disabled' },
      max_output_tokens: 32,
      stream: false,
      store: false,
    },
  })
  arkText(response)
}

export function arkImage(response: ArkResponse): Buffer {
  const encoded = response.data?.[0]?.b64_json
  if (typeof encoded !== 'string') throw new ArkError('方舟未返回内联 PNG。', 'failed')
  const image = Buffer.from(encoded, 'base64')
  if (image.length <= 8 || image.length > 20 * 1024 * 1024 || !image.subarray(0, 8).equals(pngSignature)) {
    throw new ArkError('方舟图片不是有效的 PNG。', 'failed')
  }
  return image
}
