import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'

const SALT_BYTES = 16
const HASH_BYTES = 64
const DUMMY_PASSWORD_HASH = `${'00'.repeat(SALT_BYTES)}.${'00'.repeat(HASH_BYTES)}`
export const DEFAULT_ADMIN_USERNAME = 'admin'

export function isNewAdminPassword(password: unknown): password is string {
  return typeof password === 'string' && password.length >= 12 && password.length <= 128
}

export function isAdminUsername(username: string): boolean {
  return /^[a-z0-9._-]{3,48}$/.test(username)
}

export function normalizeAdminUsername(username: string): string {
  return username.trim().toLowerCase()
}

function derivePassword(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      HASH_BYTES,
      { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 ** 2 },
      (error, hash) => {
        if (error) return reject(error)
        resolve(hash)
      },
    )
  })
}

export async function hashAdminPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES)
  const hash = await derivePassword(password, salt)
  return `${salt.toString('hex')}.${hash.toString('hex')}`
}

export async function verifyAdminPassword(password: string, storedHash?: string): Promise<boolean> {
  const [salt, encodedHash] = (storedHash || DUMMY_PASSWORD_HASH).split('.')
  const hash = await derivePassword(password, Buffer.from(salt, 'hex'))
  const expected = Buffer.from(encodedHash ?? '', 'hex')
  return expected.length === HASH_BYTES && timingSafeEqual(hash, expected) && Boolean(storedHash)
}
