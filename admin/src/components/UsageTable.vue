<script setup lang="ts">
import { ElTable, ElTableColumn, ElTag } from 'element-plus'
import type { UsageCall } from '../api/ai-admin'
import { formatUsageCost } from '../lib/format-usage-cost'

defineProps<{ rows: UsageCall[] }>()
const labels: Record<UsageCall['result'], string> = { running: '调用中', success: '成功', failed: '失败', unknown: '结果未知' }
const tagTypes = { running: 'info', success: 'success', failed: 'danger', unknown: 'warning' } as const
const date = new Intl.DateTimeFormat('zh-CN', { dateStyle: 'short', timeStyle: 'medium' })

function resultLabel(row: UsageCall): string {
  if (row.result === 'success' && row.jobStatus === 'failed') return '生成成功 / 任务未完成'
  return labels[row.result] ?? '—'
}
</script>

<template>
  <ElTable :data="rows" row-key="id" empty-text="没有符合条件的调用" stripe>
    <ElTableColumn label="时间" min-width="160"><template #default="{ row }">{{ date.format(new Date(row.startedAt)) }}</template></ElTableColumn>
    <ElTableColumn prop="name" label="桌面名称" min-width="100" show-overflow-tooltip />
    <ElTableColumn label="类型" width="85"><template #default="{ row }">{{ row.type === 'chat' ? '对话' : '生图' }}</template></ElTableColumn>
    <ElTableColumn label="结果" min-width="155"><template #default="{ row }"><ElTag disable-transitions size="small" :type="row.result === 'success' && row.jobStatus === 'failed' ? 'warning' : tagTypes[(row as UsageCall).result]">{{ resultLabel(row as UsageCall) }}</ElTag></template></ElTableColumn>
    <ElTableColumn label="输入 / 输出 / 缓存 Token" min-width="180">
      <template #default="{ row }">
        {{ row.type === 'chat' ? `${row.inputTokens ?? '—'} / ${row.outputTokens ?? '—'} / ${row.cachedInputTokens ?? '—'}` : '—' }}
      </template>
    </ElTableColumn>
    <ElTableColumn prop="images" label="出图" width="72"><template #default="{ row }">{{ row.images ?? '—' }}</template></ElTableColumn>
    <ElTableColumn label="预估费用" min-width="126">
      <template #default="{ row }">{{ row.cost == null ? (row.result === 'running' ? '—' : '待核算') : formatUsageCost(row.cost) }}</template>
    </ElTableColumn>
    <ElTableColumn prop="model" label="模型" min-width="160" show-overflow-tooltip />
    <ElTableColumn prop="id" label="任务 ID" min-width="135" show-overflow-tooltip />
  </ElTable>
</template>
