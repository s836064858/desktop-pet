import type { RawImage } from './spritePipeline'

export const ALIGNMENT = { size: 400, centerX: 200, footY: 380, potWidth: 180 } as const
const VISIBLE_ALPHA = 16

export interface SpriteAnchor {
  centerX: number
  footY: number
  potWidth: number
}

interface Bounds {
  left: number
  top: number
  right: number
  bottom: number
}

export function validateSpriteAnchor(options: {
  image: RawImage
  anchor: SpriteAnchor
}): void {
  const { image, anchor } = options
  const { centerX, footY, potWidth } = anchor
  if (![centerX, footY, potWidth].every(Number.isFinite) || potWidth <= 1)
    throw new Error('自动检测的花盆锚点无效，请重新生成这一帧。')
  if (
    centerX - potWidth / 2 < 0 ||
    centerX + potWidth / 2 >= image.width ||
    footY < 0 ||
    footY >= image.height
  )
    throw new Error('自动检测的花盆锚点超出原图，请重新生成这一帧。')
}

function findVisibleBounds(image: RawImage): Bounds | null {
  const bounds = { left: image.width, top: image.height, right: -1, bottom: -1 }
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      if (image.rgba[(y * image.width + x) * 4 + 3] <= VISIBLE_ALPHA) continue
      bounds.left = Math.min(bounds.left, x)
      bounds.right = Math.max(bounds.right, x)
      bounds.top = Math.min(bounds.top, y)
      bounds.bottom = Math.max(bounds.bottom, y)
    }
  }
  return bounds.right < 0 ? null : bounds
}

export function inspectSpriteAlignment(options: {
  image: RawImage
  anchor: SpriteAnchor
}): string[] {
  validateSpriteAnchor(options)
  const { image, anchor } = options
  const bounds = findVisibleBounds(image)
  if (!bounds) return ['图片没有可见主体，请重新生成这一帧。']
  const issues: string[] = []
  if (
    bounds.left === 0 ||
    bounds.top === 0 ||
    bounds.right === image.width - 1 ||
    bounds.bottom === image.height - 1
  )
    issues.push('原图主体已经触边，可能缺失植物或手脚，请重新生成这一帧。')
  const scale = ALIGNMENT.potWidth / anchor.potWidth
  const left = ALIGNMENT.centerX + (bounds.left - anchor.centerX) * scale
  const right = ALIGNMENT.centerX + (bounds.right - anchor.centerX) * scale
  const top = ALIGNMENT.footY + (bounds.top - anchor.footY) * scale
  const bottom = ALIGNMENT.footY + (bounds.bottom - anchor.footY) * scale
  if (left < 1 || top < 1 || right > ALIGNMENT.size - 2 || bottom > ALIGNMENT.size - 2)
    issues.push('自动对齐后主体或特效会触边、裁切，请重新生成这一帧。')
  return issues
}

// 与 CLI 的 growth 归一化使用相同坐标变换；预乘 alpha 插值避免透明边缘变黑。
export function normalizeSpriteAlignment(options: {
  image: RawImage
  anchor: SpriteAnchor
}): Uint8Array {
  validateSpriteAnchor(options)
  const { image, anchor } = options
  const output = new Uint8Array(ALIGNMENT.size * ALIGNMENT.size * 4)
  const scale = ALIGNMENT.potWidth / anchor.potWidth
  for (let y = 0; y < ALIGNMENT.size; y++) {
    for (let x = 0; x < ALIGNMENT.size; x++) {
      const sx = (x - ALIGNMENT.centerX) / scale + anchor.centerX
      const sy = (y - ALIGNMENT.footY) / scale + anchor.footY
      if (sx < 0 || sy < 0 || sx >= image.width - 1 || sy >= image.height - 1) continue
      samplePixel({ image, sx, sy, output, offset: (y * ALIGNMENT.size + x) * 4 })
    }
  }
  return output
}

function samplePixel(options: {
  image: RawImage
  sx: number
  sy: number
  output: Uint8Array
  offset: number
}): void {
  const { image, sx, sy, output, offset } = options
  const x0 = Math.floor(sx)
  const y0 = Math.floor(sy)
  const fx = sx - x0
  const fy = sy - y0
  const pixels = [
    [x0, y0, (1 - fx) * (1 - fy)],
    [x0 + 1, y0, fx * (1 - fy)],
    [x0, y0 + 1, (1 - fx) * fy],
    [x0 + 1, y0 + 1, fx * fy],
  ]
  const colour = [0, 0, 0]
  let alpha = 0
  for (const [x, y, weight] of pixels) {
    const source = (y * image.width + x) * 4
    const coverage = image.rgba[source + 3] * weight
    alpha += coverage
    for (let channel = 0; channel < 3; channel++)
      colour[channel] += image.rgba[source + channel] * coverage
  }
  output[offset + 3] = Math.round(alpha)
  if (alpha <= 0) return
  for (let channel = 0; channel < 3; channel++)
    output[offset + channel] = Math.round(colour[channel] / alpha)
}
