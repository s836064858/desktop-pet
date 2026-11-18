<script setup lang="ts">
import type { ModelPrice } from '../api/ai-admin'
import { formatUsageCost } from '../lib/format-usage-cost'

defineProps<{ pricing: ModelPrice[] }>()
</script>

<template>
  <section aria-labelledby="pricing-title">
    <h2 id="pricing-title">模型定价</h2>
    <dl class="pricing">
      <div v-for="price in pricing" :key="price.model">
        <dt>{{ price.model }}</dt>
        <dd v-if="price.type === 'image'">{{ formatUsageCost(price.perImage) }} / 张</dd>
        <dd v-else>
          <span>未命中输入 {{ formatUsageCost(price.inputPerMillion) }}</span>
          <span>输出 {{ formatUsageCost(price.outputPerMillion) }}</span>
          <span>缓存命中 {{ formatUsageCost(price.cachedInputPerMillion) }}</span>
          <small>每百万 Token</small>
        </dd>
      </div>
    </dl>
  </section>
</template>

<style scoped>
h2 { margin: 0 0 0.75rem; font-size: 1rem; }
.pricing { margin: 0; }
.pricing div { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0.35rem 1rem; padding: 0.55rem 0; }
.pricing div + div { border-top: 1px solid var(--color-line); }
.pricing dt { font-weight: 600; overflow-wrap: anywhere; }
.pricing dd { display: flex; flex-wrap: wrap; gap: 0.25rem 0.85rem; margin: 0; font-variant-numeric: tabular-nums; }
.pricing small { color: var(--color-muted); }
</style>
