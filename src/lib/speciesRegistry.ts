// 物种注册表：内置 4 物种（import.meta.glob 静态资产）+ 本地资源库自定义物种（appData 运行时生成）
import { SPECIES_LIST } from '../config/species'
import type { SpeciesConfig } from '../config/species'
import { fileToObjectUrl, listCustomSpecies } from './spriteLibrary'
import { getSpeciesPreviewUrl } from './speciesArt'
import { readCareProfile } from './careProfile'

export interface SpeciesCardItem extends SpeciesConfig {
  isCustom: boolean
  previewUrl: string | null
  desc?: string
}

export async function listSpeciesCards(
  options: { signal?: AbortSignal } = {},
): Promise<SpeciesCardItem[]> {
  options.signal?.throwIfAborted()
  const builtins: SpeciesCardItem[] = SPECIES_LIST.map((species) => ({
    ...species,
    isCustom: false,
    previewUrl: getSpeciesPreviewUrl(species.code),
  }))
  const customs = await listCustomSpecies()
  options.signal?.throwIfAborted()
  const customItems: SpeciesCardItem[] = []
  for (const meta of customs) {
    options.signal?.throwIfAborted()
    let previewUrl: string | null = null
    try {
      previewUrl = await getCustomPreviewUrl(meta.code, options.signal)
    } catch {
      previewUrl = null
    }
    customItems.push({
      code: meta.code,
      name: meta.name,
      emoji: meta.emoji,
      hue: 0,
      firstTaskDelayMin: 5,
      isCustom: true,
      previewUrl,
      desc: meta.desc,
      careProfile: readCareProfile(meta.careProfile, meta.code),
    })
  }
  return [...builtins, ...customItems]
}

async function getCustomPreviewUrl(code: string, signal?: AbortSignal): Promise<string> {
  const { join, appDataDir } = await import('@tauri-apps/api/path')
  const file = await join(await appDataDir(), 'sprite-library', code, 'stage0', 'idle1.png')
  return fileToObjectUrl(file, signal)
}

export function builtinSpeciesCodes(): Set<string> {
  // empty-pot 是未领养态的伪物种（有帧、无配置），保留 code 不允许自定义物种占用
  return new Set([...SPECIES_LIST.map((s) => s.code), 'empty-pot'])
}
