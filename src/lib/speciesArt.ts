import type { GrowthStage } from './growth'
import { GROWTH_STAGE_KEYS } from './spriteFrames'
import type { FrameName, SpeciesFrames } from './spriteFrames'

export type { FrameName } from './spriteFrames'
type StageMap = SpeciesFrames<string>

const frameModules = import.meta.glob('../assets/pets/*/*/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>

const SPECIES_FRAMES: Record<string, StageMap> = {}
const CUSTOM_FRAMES: Record<string, StageMap> = {}

for (const [path, url] of Object.entries(frameModules)) {
  const match = path.match(
    /pets\/([^/]+)\/(stage0|juvenile|adult|full)\/([a-z]+)\d*\.png$/,
  )
  if (!match) continue
  const [, species, stage, state] = match
  const stages = (SPECIES_FRAMES[species] ??= {})
  const frames = (stages[stage as keyof StageMap] ??= {})
  frames[state as FrameName] = url
}

export function registerCustomSpeciesFrames(speciesCode: string, frames: StageMap): void {
  CUSTOM_FRAMES[speciesCode] = frames
}

export function clearCustomSpeciesFrames(): void {
  for (const code of Object.keys(CUSTOM_FRAMES)) delete CUSTOM_FRAMES[code]
}

export function isBuiltinSpecies(speciesCode: string): boolean {
  return Boolean(SPECIES_FRAMES[speciesCode])
}

export function hasSpeciesArt(speciesCode: string): boolean {
  return Boolean(getSpeciesFrame(speciesCode, 'idle'))
}

export function hasGrowthArt(speciesCode: string): boolean {
  const stages = SPECIES_FRAMES[speciesCode] ?? CUSTOM_FRAMES[speciesCode]
  return GROWTH_STAGE_KEYS.every((stage) => Boolean(stages?.[stage]?.idle))
}

export function getSpeciesFrame(
  speciesCode: string,
  name: FrameName,
  stage: GrowthStage = 'juvenile',
): string | null {
  const stages = SPECIES_FRAMES[speciesCode] ?? CUSTOM_FRAMES[speciesCode]
  const frames = stages?.[stage]
  // 缺失状态先退回同阶段 idle，再使用同物种旧图，不跨物种切换。
  return (
    frames?.[name] ??
    frames?.idle ??
    stages?.stage0?.[name] ??
    stages?.stage0?.idle ??
    null
  )
}

export function getSpeciesPreviewUrl(speciesCode: string): string | null {
  return getSpeciesFrame(speciesCode, 'idle')
}
