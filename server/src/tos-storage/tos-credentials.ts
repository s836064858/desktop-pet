import { ServiceUnavailableException } from '@nestjs/common'
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

export interface TosCredentials {
  accessKeyId: string
  accessKeySecret: string
}

const IV_LENGTH = 12
const TAG_LENGTH = 16
const CREDENTIAL_CONTEXT = Buffer.from('sproutkin:tos-credentials:v1')

function readEncryptionKey(): Buffer {
  const key = process.env.CONFIG_ENCRYPTION_KEY?.trim() ?? ''
  if (!/^[a-f\d]{64}$/i.test(key)) {
    throw new ServiceUnavailableException('服务端缺少有效的配置加密密钥。')
  }
  return Buffer.from(key, 'hex')
}

export function encryptTosCredentials(credentials: TosCredentials): Buffer {
  return encryptConfig(credentials, CREDENTIAL_CONTEXT)
}

export function encryptConfig(value: object, context: Buffer): Buffer {
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv('aes-256-gcm', readEncryptionKey(), iv)
  cipher.setAAD(context)
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(value), 'utf8'),
    cipher.final(),
  ])
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted])
}

export function decryptTosCredentials(data: Buffer): TosCredentials {
  return decryptConfig<TosCredentials>(data, CREDENTIAL_CONTEXT)
}

export function decryptConfig<T>(data: Buffer, context: Buffer): T {
  const encryptionKey = readEncryptionKey()
  try {
    const tagEnd = IV_LENGTH + TAG_LENGTH
    const decipher = createDecipheriv('aes-256-gcm', encryptionKey, data.subarray(0, IV_LENGTH))
    decipher.setAAD(context)
    decipher.setAuthTag(data.subarray(IV_LENGTH, tagEnd))
    const plaintext = Buffer.concat([decipher.update(data.subarray(tagEnd)), decipher.final()])
    return JSON.parse(plaintext.toString('utf8')) as T
  } catch {
    throw new ServiceUnavailableException('供应商凭证无法读取，请检查服务端加密配置。')
  }
}
