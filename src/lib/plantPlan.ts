import { FRAME_KEYS, GROWTH_STAGE_KEYS, GROWTH_STAGE_LABELS } from './spriteFrames'
import type { FrameName, GrowthDescriptions } from './spriteFrames'
import { validateCareProfile } from './careProfile'
import type { CareProfile } from './careProfile'

export interface PlantPlan {
  name: string
  emoji: string
  desc: string
  states: Record<FrameName, string>
  stages: GrowthDescriptions
  careProfile: CareProfile
}

export interface PlantChatMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  hasImage?: boolean
  imagePreviewUrl?: string
  status: 'done' | 'pending' | 'error'
}

export interface PlantPlanReply {
  reply: string
  needsClarification: boolean
  plan: PlantPlan | null
}

export function validateGrowthDescriptions(value: unknown): GrowthDescriptions {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('请补齐三个成长阶段的形态描述。')
  const descriptions = value as Record<string, unknown>
  const stages = {} as GrowthDescriptions
  for (const stage of GROWTH_STAGE_KEYS) {
    stages[stage] = readText(
      descriptions[stage],
      GROWTH_STAGE_LABELS[stage] + '形态描述',
      200,
    )
  }
  return stages
}

function readText(value: unknown, label: string, max: number): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max)
    throw new Error(`${label}需为 1–${max} 字。`)
  return value.trim()
}

export function validatePlantPlan(value: unknown): PlantPlan {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('植物档案格式不完整。')
  const obj = value as Record<string, unknown>
  const states = {} as Record<FrameName, string>
  const source = obj.states as Record<string, unknown> | null
  for (const frame of FRAME_KEYS)
    states[frame] = readText(source?.[frame], `${frame}状态描述`, 100)
  return {
    name: readText(obj.name, '植物名称', 12),
    emoji: readText(obj.emoji, '植物图标', 16),
    desc: readText(obj.desc, '外形描述', 120),
    stages: validateGrowthDescriptions(obj.stages),
    states,
    careProfile: validateCareProfile(obj.careProfile),
  }
}

export function validatePlantPlanReply(value: unknown): PlantPlanReply {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('AI 回复格式不合法。')
  const obj = value as Record<string, unknown>
  const reply = readText(obj.reply, 'AI 回复', 1600)
  if (typeof obj.needsClarification !== 'boolean')
    throw new Error('AI 未说明档案是否已明确。')
  if (obj.needsClarification) return { reply, needsClarification: true, plan: null }
  return { reply, needsClarification: false, plan: validatePlantPlan(obj.plan) }
}
