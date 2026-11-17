import type { CareProfile } from '../lib/careProfile'
import { createCareProfile } from '../lib/careProfile'

export interface SpeciesConfig {
  code: string
  name: string
  emoji: string
  hue: number
  firstTaskDelayMin: number
  careProfile?: CareProfile
}

// 仅收录已有分身素材的物种（素材管线：assets-src → scripts/process-sprites.mjs → src/assets/pets/{code}/stage0/）
// 物种默认频率驱动养护计划；习性描述仅供阅读，创建时可调整频率。
export const SPECIES: Record<string, SpeciesConfig> = {
  pothos: {
    code: 'pothos',
    name: '绿萝',
    emoji: '🌿',
    hue: 0,
    firstTaskDelayMin: 5,
    careProfile: createCareProfile('pothos'),
  },
  monstera: {
    code: 'monstera',
    name: '龟背竹',
    emoji: '🪴',
    hue: 0,
    firstTaskDelayMin: 5,
    careProfile: createCareProfile('monstera'),
  },
  succulent: {
    code: 'succulent',
    name: '多肉',
    emoji: '🌵',
    hue: 0,
    firstTaskDelayMin: 5,
    careProfile: createCareProfile('succulent'),
  },
  cactus: {
    code: 'cactus',
    name: '仙人球',
    emoji: '🌋',
    hue: 0,
    firstTaskDelayMin: 5,
    careProfile: createCareProfile('cactus'),
  },
  'foxtail-grass': {
    code: 'foxtail-grass',
    name: '狗尾巴草',
    careProfile: createCareProfile('foxtail-grass'),
    emoji: '🌾',
    hue: 0,
    firstTaskDelayMin: 5,
  },
}

export const SPECIES_LIST: SpeciesConfig[] = Object.values(SPECIES)
