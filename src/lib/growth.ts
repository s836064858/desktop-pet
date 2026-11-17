export type GrowthStage = 'juvenile' | 'adult' | 'full'

export const ADULT_GROWTH_DAYS = 14
export const FULL_GROWTH_DAYS = 42

export function getGrowthStage(days: number) {
  if (days >= FULL_GROWTH_DAYS) return { index: 2, code: 'full' as const, name: '完全体' }
  if (days >= ADULT_GROWTH_DAYS) return { index: 1, code: 'adult' as const, name: '成年体' }
  return { index: 0, code: 'juvenile' as const, name: '幼年体' }
}

export function getGrowthProgress(days: number) {
  const target = days < ADULT_GROWTH_DAYS ? ADULT_GROWTH_DAYS : FULL_GROWTH_DAYS
  const start = days < ADULT_GROWTH_DAYS ? 0 : ADULT_GROWTH_DAYS
  return {
    target,
    remaining: Math.max(0, target - days),
    percent: Math.min(100, Math.max(0, Math.round(((days - start) / (target - start)) * 100))),
  }
}

export function localDateKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
