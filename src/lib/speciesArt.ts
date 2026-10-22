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

export function hasSpeciesArt(speciesCode: string): boolean {
  return Boolean(SPECIES_FRAMES[speciesCode]?.idle)
}

export function getSpeciesFrame(speciesCode: string, name: FrameName): string | null {
  return SPECIES_FRAMES[speciesCode]?.[name] ?? null
}

export function getSpeciesPreviewUrl(speciesCode: string): string | null {
  return getSpeciesFrame(speciesCode, 'idle') ?? Object.values(SPECIES_FRAMES[speciesCode] ?? {})[0] ?? null
}
