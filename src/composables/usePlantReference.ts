import { onUnmounted, shallowRef } from 'vue'
import { preparePlantReference } from '../lib/plantReference'

export function usePlantReference() {
  const previewUrl = shallowRef('')
  const fileName = shallowRef('')
  const dimensions = shallowRef('')
  let bytes: Uint8Array | null = null
  let isActive = true

  function clear(): void {
    if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
    previewUrl.value = ''
    fileName.value = ''
    dimensions.value = ''
    bytes = null
  }

  async function replace(options: { file: File; signal: AbortSignal }): Promise<void> {
    const result = await preparePlantReference(options)
    options.signal.throwIfAborted()
    if (!isActive) throw new DOMException('操作已失效', 'AbortError')
    const url = URL.createObjectURL(result.blob)
    clear()
    bytes = result.bytes
    fileName.value = result.name
    dimensions.value = `${result.width} × ${result.height}`
    previewUrl.value = url
  }

  function getBytes(): Uint8Array | null {
    return bytes
  }

  onUnmounted(() => {
    isActive = false
    clear()
  })
  return { previewUrl, fileName, dimensions, replace, clear, getBytes }
}
