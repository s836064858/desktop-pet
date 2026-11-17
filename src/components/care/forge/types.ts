import type { FrameName } from '../../../lib/speciesArt'
import type { CareProfile } from '../../../lib/careProfile'
import type { GrowthDescriptions, GrowthFrames } from '../../../lib/spriteFrames'

export type ForgeStep = 'compose' | 'bases' | 'generate' | 'gallery'
export type FrameStatus = 'pending' | 'running' | 'checking' | 'done' | 'error'
export type GrowthFrameStatus = GrowthFrames<FrameStatus>
export interface ForgeForm {
  code: string
  name: string
  emoji: string
  desc: string
  states: Record<FrameName, string>
  stages: GrowthDescriptions
  careProfile: CareProfile
}
export const FRAME_META: Record<FrameName, { label: string; icon: string }> = {
  idle: { label: '基础形象', icon: 'leaf' },
  happy: { label: '开心', icon: 'smile' },
  thirsty: { label: '缺水', icon: 'water' },
  water: { label: '浇水', icon: 'water' },
  sun: { label: '光照舒适', icon: 'sun' },
  sleep: { label: '熟睡', icon: 'moon' },
}
export const FRAME_STATUS_LABELS: Record<FrameStatus, string> = {
  pending: '等待',
  running: '生成中',
  checking: '自动检查',
  done: '检查通过',
  error: '生成或检查失败',
}
