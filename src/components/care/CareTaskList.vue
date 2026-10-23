<script setup lang="ts">
import { computed } from 'vue'
import type { CareTask, CareTaskStatus } from '../../lib/database'
import AppIcon from '../common/AppIcon.vue'
const props = defineProps<{ tasks: CareTask[]; isSnoozing: boolean }>()
defineEmits<{ snooze: [taskId: number] }>()
const statusLabels: Record<CareTaskStatus, string> = {
  pending: '待提醒',
  reminded: '待养护',
  overdue: '已逾期',
  done: '已完成',
  done_late: '补做',
}
const rows = computed(() =>
  props.tasks.map((task) => ({
    ...task,
    label: task.type === 'water' ? '浇水' : '晒太阳',
    statusLabel: statusLabels[task.status],
    isDue: task.status === 'reminded' || task.status === 'overdue',
    timeLabel: new Date(task.scheduled_at).toLocaleString('zh-CN', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }),
  })),
)
</script>
<template>
  <section class="task-section">
    <div class="section-heading">
      <h2 class="section-title">养护计划</h2>
      <span class="muted">在桌面植物上完成养护</span>
    </div>
    <div v-if="rows.length" class="task-list">
      <div v-for="task in rows" :key="task.id" class="task-row" :class="{ 'is-due': task.isDue }">
        <AppIcon :name="task.type" :size="26" class="task-icon" />
        <span class="task-name">{{ task.label }}</span>
        <time class="task-time" :datetime="new Date(task.scheduled_at).toISOString()">{{
          task.timeLabel
        }}</time>
        <span class="task-status" :class="{ 'is-due': task.isDue }">{{ task.statusLabel }}</span>
        <el-button
          :disabled="isSnoozing || task.snooze_count >= 3"
          :title="task.snooze_count >= 3 ? '已推迟三次，不能再推迟' : '延后两小时提醒'"
          @click="$emit('snooze', task.id)"
          >稍后</el-button
        >
      </div>
    </div>
    <p v-else class="inline-note">当前没有待养护任务，下一轮计划会自动安排。</p>
  </section>
</template>
<style scoped>
.task-list {
  display: grid;
  gap: 8px;
}
.task-row {
  display: grid;
  grid-template-columns: 30px 75px 1fr 72px 66px;
  gap: 12px;
  align-items: center;
  padding: 11px 14px;
  border: 1px solid #e2e2d8;
  border-radius: 9px;
  background: #fdfcf7;
}
.task-row.is-due {
  background: #fbede3;
  border-color: #edcfb9;
}
.task-icon {
  color: #bd7a42;
}
.task-name {
  font-size: 14px;
  font-weight: 600;
}
.task-time {
  font-size: 12px;
  color: #6b7364;
  font-variant-numeric: tabular-nums;
}
.task-status {
  font-size: 11px;
  text-align: center;
  padding: 4px 8px;
  background: #e5eadb;
  border-radius: 20px;
  color: #5f7454;
}
.task-status.is-due {
  background: #c87955;
  color: #fff;
}
.task-row .el-button {
  padding-inline: 16px;
}
@media (max-width: 600px) {
  .task-row {
    grid-template-columns: 24px 60px 1fr 60px;
    gap: 8px;
    padding: 10px;
  }
  .task-time {
    grid-column: 2 / 4;
    grid-row: 2;
  }
  .task-row .el-button {
    grid-column: 4;
    grid-row: 1 / 3;
  }
  .task-status {
    grid-column: 3;
    grid-row: 1;
    justify-self: end;
  }
}
</style>
