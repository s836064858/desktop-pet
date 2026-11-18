import { BadRequestException } from '@nestjs/common'

export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new BadRequestException('请求格式无效。')
  }
  return value as Record<string, unknown>
}

export function text(value: unknown, max: number, label: string): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max) {
    throw new BadRequestException(`${label}需为 1–${max} 字。`)
  }
  return value.trim()
}

export function uuid(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(value)) {
    throw new BadRequestException('操作标识无效。')
  }
  return value
}

export function revision(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value >= 4294967295) {
    throw new BadRequestException('配置或草稿版本无效。')
  }
  return value
}
