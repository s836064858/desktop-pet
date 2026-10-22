import { deflateSync, inflateSync } from 'node:zlib'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SRC_DIR = resolve(ROOT, 'assets-src')
const OUT_DIR = resolve(ROOT, 'src/assets/pets')
const TARGET = 400
const WHITE_TOL = 20

const MAP = [
  // 绿萝
  { dir: '绿萝', file: '52design-free-creation-free-media-ca0ad4d88b434874b9e03fb109e2c3d9-1792645960139.png', species: 'pothos', name: 'idle1' },
  { dir: '绿萝', file: '52design-free-creation-free-media-f5547a7fb9124bc5a70a05f4c4ac91ef-1792645967294.png', species: 'pothos', name: 'happy1' },
  { dir: '绿萝', file: '52design-free-creation-free-media-5887c6bcaf2d498289ea61a4d34cdac9-1792645961895.png', species: 'pothos', name: 'thirsty1' },
  { dir: '绿萝', file: '52design-free-creation-free-media-39b54a0ffb9f4ca0928059d062d3c61d-1792645963512.png', species: 'pothos', name: 'water1' },
  { dir: '绿萝', file: '52design-free-creation-free-media-4e214c6d104a4b7e9dafdcf2ada3d9f3-1792645968994.png', species: 'pothos', name: 'sun1' },
  { dir: '绿萝', file: '52design-free-creation-free-media-c8409ced5bcf4b4db9089c0240ef1fb2-1792645965411.png', species: 'pothos', name: 'sleep1' },
  // 龟背竹
  { dir: '龟背竹', file: '52design-free-creation-free-media-417cdc0f501d458081e9931db8f9ec21-1792646947347.png', species: 'monstera', name: 'idle1' },
  { dir: '龟背竹', file: '52design-free-creation-free-media-6074ffffdcbc45ce9805ddaed1c2280e-1792646941831.png', species: 'monstera', name: 'happy1' },
  { dir: '龟背竹', file: '52design-free-creation-free-media-89c6f3ee713443f39b97fa3625ff506b-1792646945264.png', species: 'monstera', name: 'thirsty1' },
  { dir: '龟背竹', file: '52design-free-creation-free-media-09fe6b3225ea46e4bad6ed094ecfbd78-1792646949464.png', species: 'monstera', name: 'water1' },
  { dir: '龟背竹', file: '52design-free-creation-free-media-1e62b07e38734c5cb20260d12d901139-1792646943464.png', species: 'monstera', name: 'sun1' },
  { dir: '龟背竹', file: '52design-free-creation-free-media-bf3a9068b4434243ad473791e2d8d67b-1792646940397.png', species: 'monstera', name: 'sleep1' },
  // 多肉
  { dir: '多肉', file: '52design-free-creation-free-media-476d7e5abf5d45b889462e8d0612bb11-1792647108831.png', species: 'succulent', name: 'idle1' },
  { dir: '多肉', file: '52design-free-creation-free-media-328bac04b23c4353a73620c47dcfd263-1792647112515.png', species: 'succulent', name: 'happy1' },
  { dir: '多肉', file: '52design-free-creation-free-media-cd345ffe00e4486a8d1ecb8f4611c133-1792647115499.png', species: 'succulent', name: 'thirsty1' },
  { dir: '多肉', file: '52design-free-creation-free-media-dd41525ee91c41d09b04ce9a7e8612d6-1792647106765.png', species: 'succulent', name: 'water1' },
  { dir: '多肉', file: '52design-free-creation-free-media-f1df1b38ccda49b6bfa7aa94599807aa-1792647110415.png', species: 'succulent', name: 'sun1' },
  { dir: '多肉', file: '52design-free-creation-free-media-2f779d3fcc53431a84f3ebf0328bf46d-1792647114015.png', species: 'succulent', name: 'sleep1' },
  // 仙人球
  { dir: '仙人球', file: '52design-free-creation-free-media-2bbdbf2dfd5446449478b205272544e7-1792647299000.png', species: 'cactus', name: 'idle1' },
  { dir: '仙人球', file: '52design-free-creation-free-media-b828d654baed41a795284ebc8db22921-1792647297048.png', species: 'cactus', name: 'happy1' },
  { dir: '仙人球', file: '52design-free-creation-free-media-39513b0652644eb9930e180a717f6bc1-1792647295399.png', species: 'cactus', name: 'thirsty1' },
  { dir: '仙人球', file: '52design-free-creation-free-media-0d19d6c4d40642baadf9a8e6ea1c6e51-1792647301766.png', species: 'cactus', name: 'water1' },
  { dir: '仙人球', file: '52design-free-creation-free-media-5d4e1e4abb304863806ed26b200c4be4-1792647307082.png', species: 'cactus', name: 'sun1' },
  { dir: '仙人球', file: '52design-free-creation-free-media-eada6f193d9349bc9d4f46718a462593-1792647314250.png', species: 'cactus', name: 'sleep1' },
]

const CRC_TABLE = new Uint32Array(256)
for (let n = 0; n < 256; n++) {
  let c = n
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  }
  CRC_TABLE[n] = c >>> 0
}

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  }
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
    chunk('IEND', Buffer.alloc(0)),
  ])
}

function paeth(a, b, c) {
  const p = a + b - c
  const pa = Math.abs(p - a)
  const pb = Math.abs(p - b)
  const pc = Math.abs(p - c)
  if (pa <= pb && pa <= pc) return a
  if (pb <= pc) return b
  return c
}

function decodePng(buffer) {
  if (buffer.readUInt32BE(0) !== 0x89504e47) {
    throw new Error('不是 PNG 文件')
  }
  let offset = 8
  let width = 0
  let height = 0
  let colorType = 0
  const idatParts = []
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset)
    const type = buffer.toString('ascii', offset + 4, offset + 8)
    const data = buffer.subarray(offset + 8, offset + 8 + length)
    if (type === 'IHDR') {
      width = data.readUInt32BE(0)
      height = data.readUInt32BE(4)
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
  const inflated = inflateSync(Buffer.concat(idatParts))
  const stride = width * channels
  const raw = Buffer.alloc(width * height * channels)
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
  const rgba = Buffer.alloc(width * height * 4)
  for (let i = 0; i < width * height; i++) {
    rgba[i * 4] = raw[i * channels]
    rgba[i * 4 + 1] = raw[i * channels + 1]
    rgba[i * 4 + 2] = raw[i * channels + 2]
    rgba[i * 4 + 3] = channels === 4 ? raw[i * channels + 3] : 255
  }
  return { width, height, rgba }
}

function isNearWhite(rgba, i) {
  return rgba[i] >= 255 - WHITE_TOL && rgba[i + 1] >= 255 - WHITE_TOL && rgba[i + 2] >= 255 - WHITE_TOL
}

function removeWhiteBackground(rgba, width, height) {
  const total = width * height
  const visited = new Uint8Array(total)
  const queue = new Int32Array(total)
  let head = 0
  let tail = 0
  const push = (index) => {
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
    const y = (index / width) | 0
    if (x > 0) push(index - 1)
    if (x < width - 1) push(index + 1)
    if (y > 0) push(index - width)
    if (y < height - 1) push(index + width)
  }
}

function featherEdges(rgba, width, height) {
  const alphaCopy = Buffer.alloc(width * height)
  for (let i = 0; i < width * height; i++) {
    alphaCopy[i] = rgba[i * 4 + 3]
  }
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const index = y * width + x
      if (alphaCopy[index] === 0) {
        continue
      }
      const p = index * 4
      const neighbours = [
        alphaCopy[index - 1], alphaCopy[index + 1],
        alphaCopy[index - width], alphaCopy[index + width],
      ]
      const transparentNeighbours = neighbours.filter((a) => a === 0).length
      if (transparentNeighbours >= 2 && rgba[p] > 200 && rgba[p + 1] > 200 && rgba[p + 2] > 200) {
        rgba[p + 3] = 150
      }
    }
  }
}

function resizeBilinear(rgba, width, height, target) {
  const out = Buffer.alloc(target * target * 4)
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

for (const { dir, file, species, name } of MAP) {
  const { width, height, rgba } = decodePng(readFileSync(resolve(SRC_DIR, dir, file)))
  removeWhiteBackground(rgba, width, height)
  featherEdges(rgba, width, height)
  const out = resizeBilinear(rgba, width, height, TARGET)
  const outDir = resolve(OUT_DIR, species, 'stage0')
  mkdirSync(outDir, { recursive: true })
  writeFileSync(resolve(outDir, `${name}.png`), encodePng(out, TARGET, TARGET))
  console.log(`${species}/${name}.png  <-  ${dir}/${file} (${width}x${height})`)
}
console.log(`done -> ${OUT_DIR}`)
