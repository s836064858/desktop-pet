// 素材切图管线的浏览器移植版，算法与 scripts/process-sprites.mjs 保持一致：
// PNG 解码 → 边缘泛洪抠白底 → 近白羽化 → 双线性归一 400×400 → PNG 编码
// 压缩走 CompressionStream（zlib 格式，与 PNG IDAT 要求一致）；仅支持 8bit 非隔行 RGB/RGBA
const TARGET = 400
const WHITE_TOL = 20
const PNG_SIGNATURE = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

const CRC_TABLE = new Uint32Array(256)
for (let n = 0; n < 256; n++) {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  CRC_TABLE[n] = c >>> 0
}

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = (CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)) >>> 0
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length)
  const dv = new DataView(out.buffer)
  dv.setUint32(0, data.length)
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i)
  out.set(data, 8)
  dv.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)))
  return out
}

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, p) => sum + p.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const p of parts) {
    out.set(p, offset)
    offset += p.length
  }
  return out
}

async function zlibDeflate(data: Uint8Array): Promise<Uint8Array> {
  if (typeof CompressionStream === 'undefined') {
    throw new Error('当前 WebView 不支持 CompressionStream，无法编码 PNG')
  }
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new CompressionStream('deflate'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

async function zlibInflate(data: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('当前 WebView 不支持 DecompressionStream，无法解码 PNG')
  }
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

export interface RawImage {
  width: number
  height: number
  rgba: Uint8Array
}

export async function decodePng(buffer: Uint8Array): Promise<RawImage> {
  const dv = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength)
  if (buffer.length < 8 || dv.getUint32(0) !== 0x89504e47) {
    throw new Error('不是 PNG 文件')
  }
  let width = 0
  let height = 0
  let colorType = 0
  const idatParts: Uint8Array[] = []
  let offset = 8
  while (offset + 8 <= buffer.length) {
    const length = dv.getUint32(offset)
    const type = String.fromCharCode(buffer[offset + 4], buffer[offset + 5], buffer[offset + 6], buffer[offset + 7])
    const data = buffer.subarray(offset + 8, offset + 8 + length)
    if (type === 'IHDR') {
      width = dv.getUint32(offset + 8)
      height = dv.getUint32(offset + 12)
      if (data[8] !== 8 || data[12] !== 0) {
        throw new Error('仅支持 8bit 非隔行 PNG')
      }
      colorType = data[9]
    } else if (type === 'IDAT') {
      idatParts.push(data)
    } else if (type === 'IEND') {
      break
    }
    offset += 12 + length
  }
  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : 0
  if (channels === 0) {
    throw new Error(`不支持的颜色类型 ${colorType}`)
  }
  const inflated = await zlibInflate(concat(idatParts))
  const stride = width * channels
  const raw = new Uint8Array(width * height * channels)
  let pos = 0
  for (let y = 0; y < height; y++) {
    const filter = inflated[pos]
    pos += 1
    const line = inflated.subarray(pos, pos + stride)
    pos += stride
    for (let x = 0; x < stride; x++) {
      const left = x >= channels ? raw[y * stride + x - channels] : 0
      const up = y > 0 ? raw[(y - 1) * stride + x] : 0
      const upLeft = y > 0 && x >= channels ? raw[(y - 1) * stride + x - channels] : 0
      let value = line[x]
      if (filter === 1) value += left
      else if (filter === 2) value += up
      else if (filter === 3) value += (left + up) >> 1
      else if (filter === 4) value += paeth(left, up, upLeft)
      raw[y * stride + x] = value & 0xff
    }
  }
  const rgba = new Uint8Array(width * height * 4)
  for (let i = 0; i < width * height; i++) {
    rgba[i * 4] = raw[i * channels]
    rgba[i * 4 + 1] = raw[i * channels + 1]
    rgba[i * 4 + 2] = raw[i * channels + 2]
    rgba[i * 4 + 3] = channels === 4 ? raw[i * channels + 3] : 255
  }
  return { width, height, rgba }
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c
  const pa = Math.abs(p - a)
  const pb = Math.abs(p - b)
  const pc = Math.abs(p - c)
  if (pa <= pb && pa <= pc) return a
  if (pb <= pc) return b
  return c
}

function isNearWhite(rgba: Uint8Array, i: number): boolean {
  return rgba[i] >= 255 - WHITE_TOL && rgba[i + 1] >= 255 - WHITE_TOL && rgba[i + 2] >= 255 - WHITE_TOL
}

function removeWhiteBackground(rgba: Uint8Array, width: number, height: number): void {
  const total = width * height
  const visited = new Uint8Array(total)
  const queue = new Int32Array(total)
  let head = 0
  let tail = 0
  const push = (index: number): void => {
    if (!visited[index] && isNearWhite(rgba, index * 4)) {
      visited[index] = 1
      queue[tail++] = index
    }
  }
  for (let x = 0; x < width; x++) {
    push(x)
    push((height - 1) * width + x)
  }
  for (let y = 0; y < height; y++) {
    push(y * width)
    push(y * width + width - 1)
  }
  while (head < tail) {
    const index = queue[head++]
    rgba[index * 4 + 3] = 0
    const x = index % width
    const y = Math.floor(index / width)
    if (x > 0) push(index - 1)
    if (x < width - 1) push(index + 1)
    if (y > 0) push(index - width)
    if (y < height - 1) push(index + width)
  }
}

function featherEdges(rgba: Uint8Array, width: number, height: number): void {
  const alphaCopy = new Uint8Array(width * height)
  for (let i = 0; i < width * height; i++) alphaCopy[i] = rgba[i * 4 + 3]
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const index = y * width + x
      if (alphaCopy[index] === 0) continue
      const p = index * 4
      const neighbours = [alphaCopy[index - 1], alphaCopy[index + 1], alphaCopy[index - width], alphaCopy[index + width]]
      const transparentNeighbours = neighbours.filter((a) => a === 0).length
      if (transparentNeighbours >= 2 && rgba[p] > 200 && rgba[p + 1] > 200 && rgba[p + 2] > 200) {
        rgba[p + 3] = 150
      }
    }
  }
}

function resizeBilinear(rgba: Uint8Array, width: number, height: number, target: number): Uint8Array {
  const out = new Uint8Array(target * target * 4)
  for (let y = 0; y < target; y++) {
    const sy = ((y + 0.5) * height) / target - 0.5
    const y0 = Math.max(0, Math.floor(sy))
    const y1 = Math.min(height - 1, y0 + 1)
    const fy = sy - y0
    for (let x = 0; x < target; x++) {
      const sx = ((x + 0.5) * width) / target - 0.5
      const x0 = Math.max(0, Math.floor(sx))
      const x1 = Math.min(width - 1, x0 + 1)
      const fx = sx - x0
      for (let c = 0; c < 4; c++) {
        const top = rgba[(y0 * width + x0) * 4 + c] * (1 - fx) + rgba[(y0 * width + x1) * 4 + c] * fx
        const bottom = rgba[(y1 * width + x0) * 4 + c] * (1 - fx) + rgba[(y1 * width + x1) * 4 + c] * fx
        out[(y * target + x) * 4 + c] = Math.round(top * (1 - fy) + bottom * fy)
      }
    }
  }
  return out
}

export async function encodePng(rgba: Uint8Array, width: number, height: number): Promise<Uint8Array> {
  const ihdr = new Uint8Array(13)
  const dv = new DataView(ihdr.buffer)
  dv.setUint32(0, width)
  dv.setUint32(4, height)
  ihdr[8] = 8
  ihdr[9] = 6
  const stride = width * 4
  const raw = new Uint8Array((stride + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0
    raw.set(rgba.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1)
  }
  const idat = await zlibDeflate(raw)
  return concat([PNG_SIGNATURE, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', new Uint8Array(0))])
}

/** 抠白底 + 羽化 + 归一 400×400 + PNG 编码，产出可直接入库的透明底素材 */
export async function processSpritePng(png: Uint8Array): Promise<Uint8Array> {
  const { width, height, rgba } = await decodePng(png)
  removeWhiteBackground(rgba, width, height)
  featherEdges(rgba, width, height)
  const out = resizeBilinear(rgba, width, height, TARGET)
  return encodePng(out, TARGET, TARGET)
}
