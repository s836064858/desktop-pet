<script setup lang="ts">
import { computed } from 'vue'
import type { UsageDay } from '../api/ai-admin'
import { formatUsageCost, usageNumber } from '../lib/format-usage-cost'

const props = defineProps<{ trend: UsageDay[]; days: number }>()
const metrics = [
  { label: '调用', field: 'requests' }, { label: '成功出图', field: 'images' },
  { label: '失败', field: 'failures' }, { label: '结果未知', field: 'unknowns' },
  { label: '输入 Token', field: 'inputTokens' }, { label: '输出 Token', field: 'outputTokens' },
  { label: '缓存命中 Token', field: 'cachedInputTokens' },
] as const
const totals = computed(() => metrics.map(({ label, field }) => {
  const total = props.trend.reduce((sum, row) => sum + usageNumber(row[field]), 0)
  return { label, value: total.toLocaleString('zh-CN') }
}))
const unpriced = computed(() => props.trend.reduce((sum, row) => sum + usageNumber(row.unpriced), 0))
const totalCost = computed(() => {
  const total = props.trend.reduce((sum, { cost }) => sum + Math.round(usageNumber(cost) * 1e8), 0)
  return formatUsageCost(total / 1e8)
})
const bars = computed(() => {
  const lookup = new Map(props.trend.map((row) => [row.day, row]))
  const highest = Math.max(1, ...props.trend.map(({ requests }) => usageNumber(requests)))
  const today = Date.now()
  return Array.from({ length: props.days }, (_, index) => {
    const day = new Date(today - (props.days - index - 1) * 86_400_000).toISOString().slice(0, 10)
    const usage = lookup.get(day)
    const value = usageNumber(usage?.requests)
    const cost = formatUsageCost(usage?.cost)
    return { day, label: `${day} · ${value} 次 · 已核算费用 ${cost}`, height: `${value / highest * 100}%` }
  })
})
</script>

<template>
  <section aria-labelledby="usage-trend-title">
    <dl class="usage-totals">
      <div class="cost-total">
        <dt>已核算费用（估算）</dt>
        <dd>{{ totalCost }}</dd>
        <small v-if="unpriced">{{ unpriced }} 次待核算</small>
      </div>
      <div v-for="item in totals" :key="item.label"><dt>{{ item.label }}</dt><dd>{{ item.value }}</dd></div>
    </dl>
    <h2 id="usage-trend-title">每日调用趋势 <small>UTC</small></h2>
    <ol class="usage-bars">
      <li v-for="bar in bars" :key="bar.day" :title="bar.label" :aria-label="bar.label">
        <span :style="{ height: bar.height }" />
      </li>
    </ol>
    <div class="usage-dates"><span>{{ bars[0]?.day }}</span><span>{{ bars.at(-1)?.day }}</span></div>
  </section>
</template>

<style scoped>
.usage-totals { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 1px; overflow: hidden; margin: 0 0 1.35rem; border: 1px solid var(--color-line); border-radius: 6px; background: var(--color-line); }
.usage-totals div { padding: 0.7rem 0.8rem; min-width: 0; background: var(--color-subtle); }
.usage-totals .cost-total { background: var(--el-color-primary-light-9); }
.usage-totals dt, small { color: var(--color-muted); font-size: 13px; }
.usage-totals dd { margin: 0; font-size: 24px; font-weight: 650; overflow-wrap: anywhere; font-variant-numeric: tabular-nums; }
h2 { margin: 0 0 0.8rem; font-size: 1rem; }
h2 small { margin-left: 0.25rem; font-weight: 400; }
.usage-bars { display: flex; height: 132px; gap: 4px; padding: 0 0.4rem; margin: 0; list-style: none; border-bottom: 1px solid var(--color-line); background: repeating-linear-gradient(to top, transparent 0 calc(25% - 1px), var(--color-line) calc(25% - 1px) 25%); }
.usage-bars li { flex: 1; min-width: 0; display: flex; align-items: flex-end; justify-content: center; }
.usage-bars li span { width: min(100%, 3rem); background: var(--el-color-primary); border-radius: 4px 4px 0 0; }
.usage-dates { display: flex; justify-content: space-between; padding-top: 0.35rem; font-size: 12px; color: var(--color-muted); }
@media (max-width: 620px) { .usage-totals { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
</style>
