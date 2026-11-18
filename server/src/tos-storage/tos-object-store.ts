import { BadGatewayException, BadRequestException } from '@nestjs/common'
import { TosClient, TosServerError } from '@volcengine/tos-sdk'
import { randomUUID } from 'node:crypto'
import type { TosCredentials } from './tos-credentials'

export interface TosLocation {
  bucket: string
  region: string
}

export type TosTarget = TosLocation & TosCredentials

const PNG_SIGNATURE = Buffer.from('89504e470d0a1a0a', 'hex')
const PROBE_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aEDQAAAAASUVORK5CYII=',
  'base64',
)

function createClient(target: TosTarget, requestTimeout: number): TosClient {
  return new TosClient({
    accessKeyId: target.accessKeyId,
    accessKeySecret: target.accessKeySecret,
    region: target.region,
    secure: true,
    enableVerifySSL: true,
    requestTimeout,
    connectionTimeout: 3000,
    maxRetryCount: 0,
    maxConnections: 4,
  })
}

function handleTosError(stage: string, error: unknown): BadGatewayException {
  if (error instanceof TosServerError) {
    if (error.statusCode === 401 || error.statusCode === 403) {
      return new BadGatewayException(`TOS ${stage}失败，请检查访问密钥和对象权限。`)
    }
    if (error.statusCode === 404 || error.statusCode === 301) {
      return new BadGatewayException(`TOS ${stage}失败，请检查存储桶和地域。`)
    }
  }
  return new BadGatewayException(`TOS ${stage}失败，请检查连接后重试。`)
}

async function putPng(client: TosClient, bucket: string, key: string, png: Buffer) {
  try {
    return await client.putObject({
      bucket,
      key,
      body: png,
      contentType: 'image/png',
      contentLength: png.length,
    })
  } catch (error) {
    throw handleTosError('上传图片', error)
  }
}

export async function verifyTosTarget(target: TosTarget): Promise<void> {
  const client = createClient(target, 5000)
  const key = `sproutkin/checks/${randomUUID()}.png`
  const uploaded = await putPng(client, target.bucket, key, PROBE_PNG)
  const object = { bucket: target.bucket, key, versionId: uploaded.data['x-tos-version-id'] }
  try {
    const { data } = await client.getObjectV2({ ...object, dataType: 'buffer' })
    if (!Buffer.from(data.content).equals(PROBE_PNG)) throw new Error('测试图片内容不一致。')
  } catch (error) {
    throw handleTosError('读取测试图片', error)
  } finally {
    await client.deleteObject(object).catch((error: unknown) => {
      throw handleTosError('清理测试图片', error)
    })
  }
}

export async function storeGeneratedPng(options: {
  target: TosTarget
  assetId: string
  bytes: Uint8Array
}): Promise<TosLocation & { key: string; byteLength: number; versionId?: string }> {
  const { target, assetId, bytes } = options
  if (!/^[\da-z][\da-z-]{0,63}$/.test(assetId)) {
    throw new BadRequestException('图片标识无效。')
  }
  if (bytes.length <= PNG_SIGNATURE.length || bytes.length > 20 * 1024 * 1024) {
    throw new BadRequestException('图片大小超出允许范围。')
  }
  const image = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (!image.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
    throw new BadRequestException('生成结果必须为 PNG 图片。')
  }

  const key = `sproutkin/generated/${assetId}.png`
  const uploaded = await putPng(createClient(target, 15000), target.bucket, key, image)
  const versionId = uploaded.data['x-tos-version-id']
  return { bucket: target.bucket, region: target.region, key, byteLength: image.length, ...(versionId && { versionId }) }
}

export async function readGeneratedPng(target: TosTarget, key: string, byteLength: number, versionId?: string): Promise<Buffer> {
  try {
    const result = await createClient(target, 15000).getObjectV2({ bucket: target.bucket, key, dataType: 'buffer', versionId })
    const bytes = Buffer.from(result.data.content)
    if (bytes.length !== byteLength || !bytes.subarray(0, 8).equals(PNG_SIGNATURE)) throw new Error()
    return bytes
  } catch (error) {
    throw handleTosError('读取图片', error)
  }
}

export async function deleteGeneratedPng(target: TosTarget, key: string, versionId?: string): Promise<void> {
  try {
    await createClient(target, 15000).deleteObject({ bucket: target.bucket, key, versionId })
  } catch (error) {
    if (!(error instanceof TosServerError) || error.statusCode !== 404) throw handleTosError('清理图片', error)
  }
}
