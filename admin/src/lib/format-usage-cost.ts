const yuan = new Intl.NumberFormat('zh-CN', {
  style: 'currency',
  currency: 'CNY',
  maximumFractionDigits: 8,
})

export function usageNumber(value: unknown): number {
  if (typeof value !== 'number' && typeof value !== 'string') return 0
  const amount = Number(value)
  return Number.isFinite(amount) ? amount : 0
}

export function formatUsageCost(cost: string | number | null | undefined): string {
  return yuan.format(usageNumber(cost))
}
