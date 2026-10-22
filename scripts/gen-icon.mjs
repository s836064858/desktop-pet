import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const SIZE = 1024
const RADIUS = 180

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

function isInsideRoundedSquare(x, y) {
  const cx = Math.min(Math.max(x, RADIUS), SIZE - RADIUS)
  const cy = Math.min(Math.max(y, RADIUS), SIZE - RADIUS)
  return (x - cx) ** 2 + (y - cy) ** 2 <= RADIUS ** 2
}

function dist(x, y, cx, cy) {
  return Math.hypot(x - cx, y - cy)
}

const pixels = Buffer.alloc(SIZE * SIZE * 4)
for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    const i = (y * SIZE + x) * 4
    if (!isInsideRoundedSquare(x, y)) {
      pixels[i + 3] = 0
      continue
    }
    let r = 76
    let g = 175
    let b = 80
    if (dist(x, y, 512, 460) < 300) {
      r = 46
      g = 125
      b = 50
    }
    if (dist(x, y, 790, 234) < 92) {
      r = 255
      g = 241
      b = 118
    }
    const potInset = Math.floor(Math.max(0, y - 660) * 0.16)
    const inPot = y >= 660 && y <= 840 && x >= 392 + potInset && x <= 632 - potInset
    if (inPot) {
      r = 201
      g = 138
      b = 91
    }
    pixels[i] = r
    pixels[i + 1] = g
    pixels[i + 2] = b
    pixels[i + 3] = 255
  }
}

const stride = SIZE * 4
const raw = Buffer.alloc((stride + 1) * SIZE)
for (let y = 0; y < SIZE; y++) {
  raw[y * (stride + 1)] = 0
  pixels.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
}

const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(SIZE, 0)
ihdr.writeUInt32BE(SIZE, 4)
ihdr[8] = 8
ihdr[9] = 6

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw)),
  chunk('IEND', Buffer.alloc(0)),
])

const outPath = resolve(dirname(fileURLToPath(import.meta.url)), 'icon-source.png')
mkdirSync(dirname(outPath), { recursive: true })
writeFileSync(outPath, png)
console.log(`icon written: ${outPath}`)
