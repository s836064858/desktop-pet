<script setup lang="ts">
import { computed } from 'vue'
import type { CareTask, CareTaskStatus } from '../../lib/database'
import AppIcon from '../common/AppIcon.vue'
import type { CareProfile } from '../../lib/careProfile'
const props = defineProps<{
  tasks: CareTask[]
  profile: CareProfile
}>()
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
    label: task.type === 'water' ? '浇水' : '光照',
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
      <span class="muted">在桌宠上浇水或补充光照，自动记录养护</span>
    </div>
    <div v-if="rows.length" class="task-list">
      <div v-for="task in rows" :key="task.id" class="task-row" :class="{ 'is-due': task.isDue }">
        <AppIcon :name="task.type" :size="26" class="task-icon" />
        <span class="task-name"
          >{{ task.label
          }}<small
            >每
            {{ task.type === 'water' ? profile.waterEveryDays : profile.lightEveryDays }}
            天一次</small
          ></span
        >
        <time
          :title="task.isDue ? '本轮养护时间' : '下次养护时间'"
          class="task-time"
          :datetime="new Date(task.scheduled_at).toISOString()"
          >{{ task.timeLabel }}</time
        >
        <span class="task-status" :class="{ 'is-due': task.isDue }">{{ task.statusLabel }}</span>
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
  grid-template-columns: 30px 90px 1fr 72px;
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
.task-name small {
  display: block;
  font-weight: 400;
  font-size: 10px;
  color: var(--sprout-muted);
  margin-top: 4px;
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
@media (max-width: 600px) {
  .task-row {
    grid-template-columns: 24px 1fr auto;
    gap: 8px;
    padding: 10px;
  }
  .task-time {
    grid-column: 2;
    grid-row: 2;
  }
  .task-status {
    grid-column: 3;
    grid-row: 1;
    justify-self: end;
  }
}
</style>
