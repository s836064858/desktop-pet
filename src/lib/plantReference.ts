export const PLANT_REFERENCE_ACCEPT = 'image/png,image/jpeg,image/webp'
export const MAX_PLANT_REFERENCE_BYTES = 10 * 1024 * 1024
const MAX_PIXELS = 16_000_000
const MAX_EDGE = 1600
const DECODE_TIMEOUT_MS = 15000

export interface PlantReferenceImage {
  bytes: Uint8Array
  blob: Blob
  name: string
  width: number
  height: number
}

function imageType(header: Uint8Array): string {
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => header[index] === byte))
    return 'image/png'
  if (header[0] === 255 && header[1] === 216 && header[2] === 255) return 'image/jpeg'
  const marker = String.fromCharCode(...header.subarray(0, 12))
  if (marker.startsWith('RIFF') && marker.slice(8) === 'WEBP') return 'image/webp'
  throw new Error('请选择有效的 PNG、JPEG 或 WebP 图片，不支持 SVG 或其他文件。')
}

async function validateFile(file: File, signal: AbortSignal): Promise<void> {
  signal.throwIfAborted()
  if (!file.size) throw new Error('图片为空，请重新选择。')
  if (file.size > MAX_PLANT_REFERENCE_BYTES)
    throw new Error('图片不能超过 10MB，请缩小后重试。')
  const header = new Uint8Array(await file.slice(0, 16).arrayBuffer())
  signal.throwIfAborted()
  const type = imageType(header)
  if (file.type && file.type !== type)
    throw new Error('图片格式与文件内容不一致，请重新导出图片。')
}

function validateDimensions(image: HTMLImageElement): void {
  const { naturalWidth: width, naturalHeight: height } = image
  if (width < 16 || height < 16) throw new Error('图片过小，宽高均需至少 16 像素。')
  if (width * height > MAX_PIXELS)
    throw new Error('图片像素过大，请缩小至 1600 万像素以内。')
  if (width / height < 1 / 16 || width / height > 16)
    throw new Error('图片过长或过窄，请裁剪后重试。')
}

function loadImage(options: {
  image: HTMLImageElement
  url: string
  signal: AbortSignal
}): Promise<void> {
  options.signal.throwIfAborted()
  return new Promise((resolve, reject) => {
    startImageLoad({ ...options, resolve, reject })
  })
}

interface ImageLoadOptions {
  image: HTMLImageElement
  url: string
  signal: AbortSignal
  resolve: () => void
  reject: (error: Error) => void
}

function startImageLoad({ image, url, signal, resolve, reject }: ImageLoadOptions): void {
  function finish(error?: Error): void {
    clearTimeout(timer)
    signal.removeEventListener('abort', cancel)
    image.onload = null
    image.onerror = null
    if (error) {
      image.src = ''
      reject(error)
      return
    }
    resolve()
  }
  const cancel = () => finish(new DOMException('操作已取消', 'AbortError'))
  const fail = () => finish(new Error('图片无法读取，文件可能已损坏，请重新导出后上传。'))
  const timeout = () => finish(new Error('图片读取超时，请缩小图片后重试。'))
  const timer = setTimeout(timeout, DECODE_TIMEOUT_MS)
  signal.addEventListener('abort', cancel, { once: true })
  image.onload = () => finish()
  image.onerror = fail
  setImageSource({ image, url, onError: fail })
}

function setImageSource(options: {
  image: HTMLImageElement
  url: string
  onError: () => void
}): void {
  try {
    options.image.src = options.url
  } catch {
    options.onError()
  }
}

async function imageToPng(image: HTMLImageElement, signal: AbortSignal): Promise<Blob> {
  signal.throwIfAborted()
  validateDimensions(image)
  const scale = Math.min(1, MAX_EDGE / Math.max(image.naturalWidth, image.naturalHeight))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(image.naturalWidth * scale)
  canvas.height = Math.round(image.naturalHeight * scale)
  try {
    const context = canvas.getContext('2d')
    if (!context) throw new Error('当前窗口无法处理图片，请重新打开生成窗口后重试。')
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/png'),
    )
    signal.throwIfAborted()
    if (!blob) throw new Error('图片转换失败，请换一张图片重试。')
    return blob
  } finally {
    canvas.width = 0
    canvas.height = 0
  }
}

export async function preparePlantReference(options: {
  file: File
  signal: AbortSignal
}): Promise<PlantReferenceImage> {
  const { file, signal } = options
  await validateFile(file, signal)
  const image = new Image()
  const url = URL.createObjectURL(file)
  try {
    await loadImage({ image, url, signal })
    const width = image.naturalWidth
    const height = image.naturalHeight
    const blob = await imageToPng(image, signal)
    const bytes = new Uint8Array(await blob.arrayBuffer())
    signal.throwIfAborted()
    return { bytes, blob, name: file.name.slice(0, 120), width, height }
  } finally {
    image.onload = null
    image.onerror = null
    image.src = ''
    URL.revokeObjectURL(url)
  }
}
