<script setup lang="ts">
import { ElButton, ElOption, ElSelect, ElTag } from 'element-plus'
import { onMounted, shallowRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { aiAdmin } from '../api/ai-admin'
import type { UsageReport } from '../api/ai-admin'
import AdminPageHeader from '../components/AdminPageHeader.vue'
import UsagePricing from '../components/UsagePricing.vue'
import UsageTable from '../components/UsageTable.vue'
import UsageTrend from '../components/UsageTrend.vue'
import { useAiAdminAction } from '../composables/use-ai-admin-action'

const route = useRoute()
const router = useRouter()
const { isPending, errorMessage, run } = useAiAdminAction()
const days = shallowRef(7)
const displayedDays = shallowRef(7)
const result = shallowRef('all')
const type = shallowRef('all')
const filterUserId = shallowRef(typeof route.query.userId === 'string' && route.query.userId ? route.query.userId : '')
const filterNickname = shallowRef(typeof route.query.nickname === 'string' ? route.query.nickname : '')
const report = shallowRef<UsageReport | null>(null)
const outcomes = { all: '全部结果', running: '调用中', success: '成功', failed: '失败', unknown: '结果未知' }

function load() {
  return run(async (signal) => {
    const currentDays = days.value
    const params = new URLSearchParams({ days: String(currentDays) })
    if (result.value !== 'all') params.set('result', result.value)
    if (type.value !== 'all') params.set('type', type.value)
    if (filterUserId.value) params.set('userId', filterUserId.value)
    const data = await aiAdmin<UsageReport>(`/usage?${params}`, signal)
    signal.throwIfAborted()
    displayedDays.value = currentDays
    report.value = data
  })
}

async function clearUserFilter() {
  filterUserId.value = ''
  filterNickname.value = ''
  await router.replace({ query: { ...route.query, userId: undefined, nickname: undefined } })
  await load()
}

onMounted(load)
</script>

<template>
  <section>
    <AdminPageHeader title="任务与用量" section="运营数据" />
    <div class="ops-panel">
      <form class="ops-controls" aria-label="筛选调用" @submit.prevent="load">
        <ElSelect v-model="days" class="ops-select" aria-label="日期范围" :disabled="isPending"><ElOption v-for="day in [7, 14, 30]" :key="day" :value="day" :label="`近 ${day} 天`" /></ElSelect>
        <ElSelect v-model="type" class="ops-select" aria-label="调用类型" :disabled="isPending"><ElOption label="全部类型" value="all" /><ElOption label="对话" value="chat" /><ElOption label="生图" value="image" /></ElSelect>
        <ElSelect v-model="result" class="ops-select" aria-label="调用结果" :disabled="isPending"><ElOption v-for="(label, value) in outcomes" :key="value" :value="value" :label="label" /></ElSelect>
        <ElButton type="primary" native-type="submit" :loading="isPending">查询</ElButton>
        <ElTag v-if="filterUserId" closable disable-transitions type="info" @close="clearUserFilter">
          用户：{{ filterNickname || filterUserId.slice(0, 8) }}
        </ElTag>
      </form>
    </div>
    <p v-if="errorMessage" class="form-error" role="alert">{{ errorMessage }}</p>
    <template v-if="report">
      <div class="ops-panel"><UsageTrend :trend="report.trend" :days="displayedDays" /></div>
      <div class="ops-panel"><UsagePricing :pricing="report.pricing" /></div>
      <div class="ops-panel ops-panel--table">
        <div class="ops-heading"><h2>调用明细</h2><small>最多 100 条</small></div>
        <UsageTable :rows="report.calls" />
      </div>
    </template>
    <p v-else-if="isPending" role="status">正在查询用量…</p>
  </section>
</template>
