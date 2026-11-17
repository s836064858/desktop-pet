import type { RawImage } from './spritePipeline'
import type { SpriteAnchor } from './spriteAlignment'

interface Component {
  left: number
  right: number
  top: number
  bottom: number
  area: number
}

export interface SpriteGeometry {
  anchor: SpriteAnchor
  potHeightRatio: number
  footGapRatio: number
}

function isTerracotta(image: RawImage, x: number, y: number): boolean {
  const offset = (y * image.width + x) * 4
  const r = image.rgba[offset]
  const g = image.rgba[offset + 1]
  const b = image.rgba[offset + 2]
  return (
    image.rgba[offset + 3] >= 160 &&
    r > 90 &&
    g > 35 &&
    r > g * 1.1 &&
    g > b * 1.12 &&
    r - b > 40
  )
}

function isSolid(image: RawImage, x: number, y: number): boolean {
  const offset = (y * image.width + x) * 4
  const r = image.rgba[offset]
  const g = image.rgba[offset + 1]
  const b = image.rgba[offset + 2]
  return (
    image.rgba[offset + 3] >= 128 &&
    !(Math.max(r, g, b) - Math.min(r, g, b) < 18 && Math.min(r, g, b) > 150)
  )
}

function buildPotMask(image: RawImage) {
  const step = Math.max(1, Math.ceil(Math.max(image.width, image.height) / 512))
  const width = Math.ceil(image.width / step)
  const height = Math.ceil(image.height / step)
  const mask = new Uint8Array(width * height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++)
      mask[y * width + x] = Number(
        isTerracotta(
          image,
          Math.min(image.width - 1, x * step),
          Math.min(image.height - 1, y * step),
        ),
      )
  }
  return { mask, width, height, step }
}

function floodMask(options: {
  mask: Uint8Array
  width: number
  start: number
  queue: Int32Array
  onVisit?: (index: number) => void
}): Component {
  const { mask, width, start, queue, onVisit } = options
  const height = mask.length / width
  let head = 0
  let tail = 1
  queue[0] = start
  mask[start] = 2
  const component = { left: width, right: 0, top: height, bottom: 0, area: 0 }
  while (head < tail) {
    const index = queue[head++]
    const x = index % width
    const y = Math.floor(index / width)
    component.left = Math.min(component.left, x)
    component.right = Math.max(component.right, x)
    component.top = Math.min(component.top, y)
    component.bottom = Math.max(component.bottom, y)
    component.area++
    onVisit?.(index)
    for (const next of [
      x > 0 ? index - 1 : -1,
      x + 1 < width ? index + 1 : -1,
      y > 0 ? index - width : -1,
      y + 1 < height ? index + width : -1,
    ]) {
      if (next < 0 || mask[next] !== 1) continue
      mask[next] = 2
      queue[tail++] = next
    }
  }
  return component
}

function collectComponents(image: RawImage): Component[] {
  const { mask, width, step } = buildPotMask(image)
  const queue = new Int32Array(mask.length)
  const components: Component[] = []
  for (let start = 0; start < mask.length; start++) {
    if (mask[start] !== 1) continue
    const component = floodMask({ mask, width, start, queue })
    components.push({
      left: component.left * step,
      right: Math.min(image.width - 1, (component.right + 1) * step - 1),
      top: component.top * step,
      bottom: Math.min(image.height - 1, (component.bottom + 1) * step - 1),
      area: component.area * step * step,
    })
  }
  return components
}

function selectPotBody(image: RawImage): Component {
  const candidates = collectComponents(image)
    .filter((item) => {
      const width = item.right - item.left + 1
      const height = item.bottom - item.top + 1
      return (
        width >= image.width * 0.1 &&
        width <= image.width * 0.8 &&
        height >= image.height * 0.06 &&
        height <= image.height * 0.55 &&
        width / height >= 0.65 &&
        width / height <= 3 &&
        item.area / (width * height) >= 0.28 &&
        item.bottom >= image.height * 0.45
      )
    })
    .sort((a, b) => b.area - a.area)
  if (!candidates.length) throw new Error('无法可靠识别统一陶土花盆，请重新生成这一帧。')
  if (candidates[1] && candidates[1].area > candidates[0].area * 0.7)
    throw new Error('检测到多个相近的花盆候选，无法确定主体，请重新生成这一帧。')
  return candidates[0]
}

interface RimRow {
  left: number
  right: number
  y: number
}

function findRimRow(options: {
  image: RawImage
  body: Component
  y: number
}): RimRow | null {
  const { image, body, y } = options
  const bodyWidth = body.right - body.left + 1
  const center = (body.left + body.right) / 2
  const minX = Math.max(0, Math.floor(center - bodyWidth * 0.95))
  const maxX = Math.min(image.width - 1, Math.ceil(center + bodyWidth * 0.95))
  const maxGap = Math.max(2, Math.round(bodyWidth * 0.015))
  let left = -1
  let right = -1
  let best: RimRow | null = null
  for (let x = minX; x <= maxX + maxGap + 1; x++) {
    if (x <= maxX && isTerracotta(image, x, y)) {
      if (left < 0) left = x
      right = x
      continue
    }
    if (left < 0 || x - right <= maxGap) continue
    const width = right - left + 1
    if (
      width >= bodyWidth * 0.75 &&
      width <= bodyWidth * 1.7 &&
      Math.abs((left + right) / 2 - center) <= bodyWidth * 0.12
    )
      if (!best || width > best.right - best.left) best = { left, right, y }
    left = -1
  }
  return best
}

function extendRimEdge(options: {
  image: RawImage
  x: number
  y: number
  direction: number
  limit: number
}): number {
  const { image, x, y, direction, limit } = options
  let edge = x
  for (let distance = 1; distance <= limit; distance++) {
    const next = x + direction * distance
    if (next < 0 || next >= image.width || !isSolid(image, next, y)) break
    const offset = (y * image.width + next) * 4
    if (
      Math.max(image.rgba[offset], image.rgba[offset + 1], image.rgba[offset + 2]) > 120
    )
      break
    edge = next
  }
  return edge
}

function detectRim(image: RawImage, body: Component): RimRow {
  const bodyWidth = body.right - body.left + 1
  const rows: RimRow[] = []
  const minY = Math.max(0, Math.floor(body.top - bodyWidth * 0.35))
  const maxY = Math.min(image.height - 1, Math.ceil(body.top + bodyWidth * 0.25))
  for (let y = minY; y <= maxY; y++) {
    const row = findRimRow({ image, body, y })
    if (row) rows.push(row)
  }
  rows.sort((a, b) => b.right - b.left - (a.right - a.left))
  if (rows.length < Math.max(3, bodyWidth * 0.02))
    throw new Error('花盆口沿轮廓不完整，请重新生成这一帧。')
  const stable = rows.slice(0, Math.max(3, Math.ceil(rows.length * 0.2)))
  const middle = Math.floor(stable.length / 2)
  const row = stable.sort((a, b) => a.left - b.left)[middle]
  const limit = Math.ceil(bodyWidth * 0.012)
  return {
    left: extendRimEdge({ image, x: row.left, y: row.y, direction: -1, limit }),
    right: extendRimEdge({ image, x: row.right, y: row.y, direction: 1, limit }),
    y: row.y,
  }
}

function isCarrierPixel(image: RawImage, x: number, y: number): boolean {
  if (!isSolid(image, x, y)) return false
  const offset = (y * image.width + x) * 4
  const r = image.rgba[offset]
  const g = image.rgba[offset + 1]
  const b = image.rgba[offset + 2]
  return r >= g * 0.9 && g >= b * 0.9
}

function buildFootMask(image: RawImage, body: Component, rim: RimRow) {
  const potWidth = rim.right - rim.left
  const center = (rim.left + rim.right) / 2
  const left = Math.max(0, Math.floor(center - potWidth * 0.5))
  const right = Math.min(image.width - 1, Math.ceil(center + potWidth * 0.5))
  const top = body.top
  const bottom = Math.min(image.height - 1, Math.ceil(body.bottom + potWidth * 0.75))
  const width = right - left + 1
  const height = bottom - top + 1
  const mask = new Uint8Array(width * height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++)
      mask[y * width + x] = Number(isCarrierPixel(image, left + x, top + y))
  }
  return { mask, width, height, left, top, potWidth }
}

function detectFeet(image: RawImage, body: Component, rim: RimRow): number {
  const { mask, width, height, left, top, potWidth } = buildFootMask(image, body, rim)
  const rows = new Uint32Array(height)
  const queue = new Int32Array(mask.length)
  const seedY = Math.round(body.top + (body.bottom - body.top) * 0.6)
  function countRow(index: number): void {
    rows[Math.floor(index / width)]++
  }
  for (let x = 0; x < width; x++) {
    const start = (seedY - top) * width + x
    if (mask[start] !== 1 || !isTerracotta(image, left + x, seedY)) continue
    floodMask({ mask, width, start, queue, onVisit: countRow })
  }
  for (let y = rows.length - 1; y >= 0; y--) {
    if (rows[y] >= Math.max(3, potWidth * 0.025)) return top + y
  }
  throw new Error('无法可靠识别与花盆相连的脚底，请重新生成这一帧。')
}

export function detectSpriteGeometry(image: RawImage): SpriteGeometry {
  if (
    !Number.isInteger(image.width) ||
    !Number.isInteger(image.height) ||
    image.width < 16 ||
    image.height < 16 ||
    image.rgba.length !== image.width * image.height * 4
  )
    throw new Error('自动检查无法读取有效图像，请重新生成这一帧。')
  const body = selectPotBody(image)
  const rim = detectRim(image, body)
  const footY = detectFeet(image, body, rim)
  const potWidth = rim.right - rim.left
  const footGapRatio = (footY - body.bottom) / potWidth
  const potHeightRatio = (footY - rim.y) / potWidth
  if (footGapRatio < -0.02 || footGapRatio > 0.6)
    throw new Error('脚底与花盆的几何关系异常，请重新生成这一帧。')
  if (potHeightRatio < 0.45 || potHeightRatio > 1.5)
    throw new Error('花盆主体比例异常，请重新生成这一帧。')
  return {
    anchor: { centerX: (rim.left + rim.right) / 2, potWidth, footY },
    potHeightRatio,
    footGapRatio,
  }
}

export function compareSpriteGeometry(options: {
  actual: SpriteGeometry
  reference?: SpriteGeometry
}): void {
  const { actual, reference } = options
  if (!reference) return
  if (Math.abs(actual.potHeightRatio - reference.potHeightRatio) > 0.12)
    throw new Error('花盆或脚部造型与已确认主形象差异过大，请重新生成这一帧。')
}
