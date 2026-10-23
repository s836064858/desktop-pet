import type { FrameName } from '../../../lib/speciesArt'

export type ForgeStep = 'compose' | 'generate' | 'gallery'
export type FrameStatus = 'pending' | 'running' | 'done' | 'error'
export interface ForgeForm {
  code: string
  name: string
  emoji: string
  desc: string
  states: Record<FrameName, string>
  waterIntervalH: number | undefined
  sunIntervalH: number | undefined
}
export const FRAME_META: Record<FrameName, { label: string; icon: string }> = {
  idle: { label: '基础形象', icon: 'leaf' },
  happy: { label: '开心', icon: 'smile' },
  thirsty: { label: '缺水', icon: 'water' },
  water: { label: '浇水', icon: 'water' },
  sun: { label: '晒太阳', icon: 'sun' },
  sleep: { label: '熟睡', icon: 'moon' },
}
export const FRAME_STATUS_LABELS: Record<FrameStatus, string> = {
  pending: '等待',
  running: '生成中',
  done: '完成',
  error: '生成失败',
}
