export type FrameName = 'idle' | 'happy' | 'thirsty' | 'water' | 'sun' | 'sleep'

const frameModules = import.meta.glob('../assets/pets/*/stage0/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>

const SPECIES_FRAMES: Record<string, Partial<Record<FrameName, string>>> = {}

for (const [path, url] of Object.entries(frameModules)) {
  const match = path.match(/pets\/([^/]+)\/stage0\/([a-z]+)\d*\.png$/)
  if (!match) {
    continue
  }
  const [, species, state] = match
  SPECIES_FRAMES[species] = SPECIES_FRAMES[species] ?? {}
  SPECIES_FRAMES[species][state as FrameName] = url
}

// 运行时生成的自定义物种帧（appData 本地资源库），入库后由 spriteLibrary 注册进这里
const CUSTOM_FRAMES: Record<string, Partial<Record<FrameName, string>>> = {}

export function registerCustomSpeciesFrames(speciesCode: string, frames: Partial<Record<FrameName, string>>): void {
  CUSTOM_FRAMES[speciesCode] = { ...CUSTOM_FRAMES[speciesCode], ...frames }
}

export function isBuiltinSpecies(speciesCode: string): boolean {
  return Boolean(SPECIES_FRAMES[speciesCode]?.idle)
}

export function hasSpeciesArt(speciesCode: string): boolean {
  return Boolean(getSpeciesFrameMap(speciesCode)?.idle)
}

export function getSpeciesFrame(speciesCode: string, name: FrameName): string | null {
  return getSpeciesFrameMap(speciesCode)?.[name] ?? null
}

export function getSpeciesPreviewUrl(speciesCode: string): string | null {
  return getSpeciesFrame(speciesCode, 'idle') ?? Object.values(getSpeciesFrameMap(speciesCode) ?? {})[0] ?? null
}

function getSpeciesFrameMap(speciesCode: string): Partial<Record<FrameName, string>> | undefined {
  return SPECIES_FRAMES[speciesCode] ?? CUSTOM_FRAMES[speciesCode]
}
