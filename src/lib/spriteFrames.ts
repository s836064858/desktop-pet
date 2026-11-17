import type { GrowthStage } from './growth'

export const FRAME_KEYS = ['idle', 'happy', 'thirsty', 'water', 'sun', 'sleep'] as const
export type FrameName = (typeof FRAME_KEYS)[number]
export const GROWTH_STAGE_KEYS = ['juvenile', 'adult', 'full'] as const
export const GROWTH_STAGE_LABELS: Record<GrowthStage, string> = {
  juvenile: '幼年体',
  adult: '成年体',
  full: '完全体',
}
export type FrameMap<T> = Partial<Record<FrameName, T>>
export type GrowthFrames<T> = Record<GrowthStage, FrameMap<T>>
export type SpeciesFrames<T> = Partial<Record<GrowthStage | 'stage0', FrameMap<T>>>
export type GrowthDescriptions = Record<GrowthStage, string>
export interface FrameTarget {
  stage: GrowthStage
  frame: FrameName
}

export function createGrowthFrames<T>(): GrowthFrames<T> {
  return { juvenile: {}, adult: {}, full: {} }
}

export function hasCompleteGrowthFrames<T>(frames: SpeciesFrames<T>): boolean {
  return GROWTH_STAGE_KEYS.every((stage) =>
    FRAME_KEYS.every((frame) => Boolean(frames[stage]?.[frame])),
  )
}
