export interface SpeciesConfig {
  code: string
  name: string
  emoji: string
  hue: number
  firstTaskDelayMin: number
}

// 仅收录已有分身素材的物种（素材管线：assets-src → scripts/process-sprites.mjs → src/assets/pets/{code}/stage0/）
// 养护间隔全物种统一（见 lib/database.ts 的 WATER/SUN_INTERVAL_H），不再按物种配置
export const SPECIES: Record<string, SpeciesConfig> = {
  pothos: { code: 'pothos', name: '绿萝', emoji: '🌿', hue: 0, firstTaskDelayMin: 5 },
  monstera: { code: 'monstera', name: '龟背竹', emoji: '🪴', hue: 0, firstTaskDelayMin: 5 },
  succulent: { code: 'succulent', name: '多肉', emoji: '🌵', hue: 0, firstTaskDelayMin: 5 },
  cactus: { code: 'cactus', name: '仙人球', emoji: '🌋', hue: 0, firstTaskDelayMin: 5 },
  'foxtail-grass': { code: 'foxtail-grass', name: '狗尾巴草', emoji: '🌾', hue: 0, firstTaskDelayMin: 5 }
}

export const SPECIES_LIST: SpeciesConfig[] = Object.values(SPECIES)
