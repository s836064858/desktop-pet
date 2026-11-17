export interface CareProfile {
  waterEveryDays: number
  lightEveryDays: number
  description: string
}

// 频率为可在创建时调整的默认养护节奏；习性文字只用于阅读，不参与判定。
export const BUILTIN_CARE_PROFILES: Readonly<Record<string, CareProfile>> = {
  pothos: {
    waterEveryDays: 3,
    lightEveryDays: 2,
    description:
      '<p><strong>绿萝</strong>喜欢明亮的间接光，也能适应一定遮阴。盆土接近干燥时再浇透，避免长期积水；生长变慢时可适当减少浇水。</p>',
  },
  monstera: {
    waterEveryDays: 5,
    lightEveryDays: 2,
    description:
      '<p><strong>龟背竹</strong>喜欢温暖、明亮的间接光环境。叶片展开需要空间，盆土应排水通畅，避免强烈直射和长期过湿。</p>',
  },
  succulent: {
    waterEveryDays: 7,
    lightEveryDays: 1,
    description:
      '<p><strong>多肉</strong>的肥厚叶片能够储水，通常更耐干旱。适宜充足光照和排水良好的基质，浇水后充分排水，生长缓慢时减少浇水；具体需求因品种而异。</p>',
  },
  cactus: {
    waterEveryDays: 10,
    lightEveryDays: 1,
    description:
      '<p><strong>仙人球</strong>通常喜光、耐干旱，球体能储存水分。应避免长期积水，较冷或生长缓慢时减少浇水。</p>',
  },
  'foxtail-grass': {
    waterEveryDays: 2,
    lightEveryDays: 1,
    description:
      '<p><strong>狗尾巴草</strong>是具有柔软穗状花序的一年生草本，喜欢日照充足的环境。盆栽时结合盆土干湿照顾，保持排水通畅。</p>',
  },
}

export function createCareProfile(speciesCode = ''): CareProfile {
  return {
    ...(Object.hasOwn(BUILTIN_CARE_PROFILES, speciesCode)
      ? BUILTIN_CARE_PROFILES[speciesCode]
      : {
          waterEveryDays: 7,
          lightEveryDays: 1,
          description: '<p>这株植物的习性资料暂未补齐，可结合植物标签了解它的需水和光照偏好。</p>',
        }),
  }
}

export function validateCareProfile(value: unknown): CareProfile {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('植物习性数据不完整，请重新生成。')
  const profile = value as Record<string, unknown>
  if (
    typeof profile.description !== 'string' ||
    !profile.description.trim() ||
    profile.description.length > 4000
  ) {
    throw new Error('习性描述需为 1–4000 字。')
  }
  return {
    waterEveryDays: readFrequency(profile.waterEveryDays),
    lightEveryDays: readFrequency(profile.lightEveryDays),
    description: profile.description.trim(),
  }
}

function readFrequency(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 30) {
    throw new Error('浇水和光照频率需为每 1–30 天一次。')
  }
  return value
}

export function readCareProfile(value: unknown, speciesCode = ''): CareProfile {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return createCareProfile(speciesCode)
  const profile = value as Record<string, unknown>
  if ('waterEveryDays' in profile || 'lightEveryDays' in profile)
    return validateCareProfile(profile)
  const defaults = createCareProfile(speciesCode)
  const paragraphs = ['waterCondition', 'lightCondition', 'seasonalNotes']
    .map((key) => (typeof profile[key] === 'string' ? String(profile[key]).trim() : ''))
    .filter(Boolean)
  const hasBuiltin = Object.hasOwn(BUILTIN_CARE_PROFILES, speciesCode)
  return {
    waterEveryDays: hasBuiltin
      ? defaults.waterEveryDays
      : legacyDays(profile.waterCheckIntervalH, defaults.waterEveryDays),
    lightEveryDays: hasBuiltin
      ? defaults.lightEveryDays
      : legacyDays(profile.lightCheckIntervalH, defaults.lightEveryDays),
    description: paragraphs.length
      ? `<p>${paragraphs.map(escapeText).join(' ')}</p>`
      : defaults.description,
  }
}

function legacyDays(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.min(30, Math.max(1, Math.ceil(value / 24)))
    : fallback
}

function escapeText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
