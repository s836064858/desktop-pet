// 物种注册表：内置 4 物种（import.meta.glob 静态资产）+ 本地资源库自定义物种（appData 运行时生成）
import { SPECIES_LIST } from '../config/species'
import type { SpeciesConfig } from '../config/species'
import { fileToObjectUrl, listCustomSpecies } from './spriteLibrary'
import { getSpeciesPreviewUrl } from './speciesArt'

export interface SpeciesCardItem extends SpeciesConfig {
  isCustom: boolean
  previewUrl: string | null
  desc?: string
}

export async function listSpeciesCards(): Promise<SpeciesCardItem[]> {
  const builtins: SpeciesCardItem[] = SPECIES_LIST.map((species) => ({
    ...species,
    isCustom: false,
    previewUrl: getSpeciesPreviewUrl(species.code),
  }))
  const customs = await listCustomSpecies()
  const customItems: SpeciesCardItem[] = []
  for (const meta of customs) {
    let previewUrl: string | null = null
    try {
      previewUrl = await getCustomPreviewUrl(meta.code)
    } catch {
      previewUrl = null
    }
    customItems.push({
      code: meta.code,
      name: meta.name,
      emoji: meta.emoji,
      hue: 0,
      waterIntervalH: meta.waterIntervalH,
      sunIntervalH: meta.sunIntervalH,
      firstTaskDelayMin: 5,
      isCustom: true,
      previewUrl,
      desc: meta.desc,
    })
  }
  return [...builtins, ...customItems]
}

async function getCustomPreviewUrl(code: string): Promise<string> {
  const { join, appDataDir } = await import('@tauri-apps/api/path')
  const file = await join(await appDataDir(), 'sprite-library', code, 'stage0', 'idle1.png')
  return fileToObjectUrl(file)
}

export function builtinSpeciesCodes(): Set<string> {
  return new Set(SPECIES_LIST.map((s) => s.code))
}
