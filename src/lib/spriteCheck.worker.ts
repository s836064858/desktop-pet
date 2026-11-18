import { autoCheckSprite } from './spriteAutoCheck'
import type { SpriteCheckInput } from './spriteCheckClient'

self.addEventListener('message', async ({ data }: MessageEvent<SpriteCheckInput>) => {
  try {
    const result = await autoCheckSprite({ ...data, signal: new AbortController().signal })
    self.postMessage({ result }, { transfer: [result.bytes.buffer as ArrayBuffer] })
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : '图片自动检查失败。' })
  }
})
