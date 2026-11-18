import type { SpriteGeometry } from './spriteDetection'

export interface SpriteCheckInput { png: Uint8Array; reference?: SpriteGeometry }
interface SpriteCheckResult { bytes: Uint8Array; geometry: SpriteGeometry }

export function checkSpriteInWorker(input: SpriteCheckInput & { signal: AbortSignal }): Promise<SpriteCheckResult> {
  const { png, reference, signal } = input
  const deadline = AbortSignal.any([signal, AbortSignal.timeout(20000)])
  deadline.throwIfAborted()
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./spriteCheck.worker.ts', import.meta.url), { type: 'module' })

    function cleanup(): void {
      deadline.removeEventListener('abort', onAbort)
      worker.removeEventListener('message', onMessage)
      worker.removeEventListener('error', onError)
      worker.removeEventListener('messageerror', onError)
      worker.terminate()
    }

    function onAbort(): void {
      cleanup()
      reject(signal.aborted ? signal.reason : new Error('图片检查超时，请重试。'))
    }

    function onError(): void {
      cleanup()
      reject(new Error('图片检查无法完成，请重试。'))
    }

    function onMessage({ data }: MessageEvent<{ result?: SpriteCheckResult; error?: string }>): void {
      cleanup()
      if (data.result) resolve(data.result)
      else reject(new Error(data.error || '图片自动检查失败。'))
    }

    deadline.addEventListener('abort', onAbort, { once: true })
    worker.addEventListener('message', onMessage)
    worker.addEventListener('error', onError)
    worker.addEventListener('messageerror', onError)
    try {
      worker.postMessage({ png, reference } satisfies SpriteCheckInput, [png.buffer as ArrayBuffer])
    } catch {
      onError()
    }
  })
}
