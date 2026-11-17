<script setup lang="ts">
import { onUnmounted, shallowRef } from 'vue'
import { emit as emitWindowEvent } from '@tauri-apps/api/event'
import { setDevGrowthDays } from '../../lib/devGrowth'
import { ADULT_GROWTH_DAYS, FULL_GROWTH_DAYS } from '../../lib/growth'

const props = defineProps<{ plantId: number; realDays: number; previewDays: number | null }>()
const emit = defineEmits<{ changed: [] }>()
const isSaving = shallowRef(false)
const error = shallowRef('')
const stages = [
  { label: '幼年体', days: 0 },
  { label: '成年体', days: ADULT_GROWTH_DAYS },
  { label: '完全体', days: FULL_GROWTH_DAYS },
]
let isActive = true
onUnmounted(() => {
  isActive = false
})

async function preview(days: number | null): Promise<void> {
  if (isSaving.value) return
  isSaving.value = true
  error.value = ''
  try {
    await setDevGrowthDays({ plantId: props.plantId, days })
    if (!isActive) return
    emit('changed')
    await emitWindowEvent('care-changed')
  } catch {
    if (isActive) error.value = '阶段预览设置失败，请重试。'
  } finally {
    if (isActive) isSaving.value = false
  }
}
</script>

<template>
  <aside class="growth-debug" aria-label="开发环境成长调试">
    <div class="debug-heading">
      <strong>DEV · 成长阶段调试</strong><span>真实累计 {{ realDays }} 日</span>
    </div>
    <div class="debug-actions">
      <el-button
        v-for="stage in stages"
        :key="stage.days"
        :type="previewDays === stage.days ? 'primary' : 'default'"
        :disabled="isSaving"
        @click="preview(stage.days)"
        >{{ stage.label }}</el-button
      >
      <el-button :disabled="isSaving || previewDays === null" @click="preview(null)"
        >恢复真实进度</el-button
      >
    </div>
    <p>
      只预览阶段与外观，主面板和桌宠同步；不会修改真实成长、积分和养护记录。预览保留至手动恢复。
    </p>
    <p v-if="error" class="error-note" role="alert">{{ error }}</p>
  </aside>
</template>

<style scoped>
.growth-debug {
  padding: 16px 18px;
  margin: 18px 0;
  border: 1px dashed #a8b0a0;
  border-radius: 10px;
  background: #f0f1eb;
}
.debug-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  color: #56644d;
  font-size: 12px;
}
.debug-heading span {
  color: var(--sprout-muted);
}
.debug-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}
.debug-actions :deep(.el-button + .el-button) {
  margin-left: 0;
}
.growth-debug p {
  margin: 10px 0 0;
  color: var(--sprout-muted);
  font-size: 11px;
  line-height: 1.8;
}
</style>
