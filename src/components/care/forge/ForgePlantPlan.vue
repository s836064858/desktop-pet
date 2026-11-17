<script setup lang="ts">
import type { PlantPlan } from '../../../lib/plantPlan'
import {
  FRAME_KEYS,
  GROWTH_STAGE_KEYS,
  GROWTH_STAGE_LABELS,
} from '../../../lib/spriteFrames'
import { FRAME_META } from './types'
import AppIcon from '../../common/AppIcon.vue'
import HabitDescription from '../HabitDescription.vue'

defineProps<{
  plan: PlantPlan
  canGenerate: boolean
  isDisabled: boolean
  hasPendingChanges: boolean
  isReady: boolean
}>()
defineEmits<{ generate: [] }>()
</script>

<template>
  <section class="plant-plan" aria-label="当前植物方案">
    <div class="plan-heading">
      <AppIcon name="leaf" :size="24" />
      <h3 class="plan-name">{{ plan.name }}</h3>
      <span class="plan-status">{{ isReady ? '当前方案' : '待更新' }}</span>
    </div>
    <p class="plan-description">{{ plan.desc }}</p>
    <div class="plan-stages" aria-label="三阶段形态">
      <div v-for="stage in GROWTH_STAGE_KEYS" :key="stage" class="plan-stage">
        <AppIcon
          :name="stage === 'juvenile' ? 'sprout' : stage === 'adult' ? 'leaf' : 'plant'"
          :size="27"
        />
        <div>
          <h4 class="stage-name">{{ GROWTH_STAGE_LABELS[stage] }}</h4>
          <p class="stage-description">{{ plan.stages[stage] }}</p>
        </div>
      </div>
    </div>
    <div class="care-intervals">
      <span class="care-chip"
        ><AppIcon name="water" :size="17" />浇水提醒
        <strong>每 {{ plan.careProfile.waterEveryDays }} 天</strong></span
      >
      <span class="care-chip light-chip"
        ><AppIcon name="sun" :size="17" />光照提醒
        <strong>每 {{ plan.careProfile.lightEveryDays }} 天</strong></span
      >
    </div>
    <details class="plan-details">
      <summary class="details-toggle">
        查看习性与互动状态<AppIcon name="chevron-down" :size="17" />
      </summary>
      <div class="details-content">
        <HabitDescription :description="plan.careProfile.description" />
        <p class="care-note">间隔是可调整的提醒节奏，可在对话中结合实际环境修改。</p>
        <dl class="state-list">
          <template v-for="frame in FRAME_KEYS" :key="frame"
            ><dt>{{ FRAME_META[frame].label }}</dt>
            <dd>{{ plan.states[frame] }}</dd></template
          >
        </dl>
      </div>
    </details>
    <div class="plan-actions">
      <el-button
        class="generate-button"
        type="primary"
        :disabled="!canGenerate || isDisabled"
        @click="$emit('generate')"
        >按此方案生成主形象<AppIcon name="arrow-right" :size="18"
      /></el-button>
      <p class="plan-hint">
        {{
          hasPendingChanges
            ? '还有未发送的修改，请先发送或清空。'
            : isReady
              ? '还想调整？继续告诉我就好。'
              : '请先完成本轮对话，再确认方案。'
        }}
      </p>
    </div>
  </section>
</template>

<style scoped>
.plant-plan {
  margin-top: 10px;
  padding: 18px;
  border: 1px solid #b9c7ab;
  border-radius: 12px;
  background: #fffef9;
}
.plan-heading {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #55794b;
}
.plan-name {
  margin: 0;
  font-size: 19px;
  font-weight: 650;
  color: #365b3c;
}
.plan-status {
  padding: 4px 8px;
  border-radius: 5px;
  background: #edf1e3;
  color: #6b805b;
  font-size: 10px;
}
.plan-description {
  margin: 10px 0 18px;
  color: #64715c;
  font-size: 12px;
  line-height: 1.8;
  overflow-wrap: anywhere;
}
.plan-stages {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 18px;
}
.plan-stage {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  color: #83996d;
}
.plan-stage + .plan-stage {
  padding-left: 12px;
  border-left: 1px solid var(--sprout-line);
}
.stage-name {
  margin: 0 0 5px;
  color: #4e6e43;
  font-size: 12px;
  font-weight: 600;
}
.stage-description {
  margin: 0;
  color: #7b8275;
  font-size: 11px;
  line-height: 1.8;
  overflow-wrap: anywhere;
}
.care-intervals {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 14px 0;
  border-top: 1px solid var(--sprout-line);
}
.care-chip {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 6px 9px;
  border-radius: 7px;
  color: #6b8054;
  background: #f0f3e9;
  font-size: 11px;
}
.care-chip strong {
  margin-left: 3px;
  color: #636d5e;
  font-weight: 400;
}
.light-chip {
  background: #f8f0e6;
  color: #af7d51;
}
.plan-details {
  border-top: 1px solid var(--sprout-line);
  border-bottom: 1px solid var(--sprout-line);
}
.details-toggle {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  padding: 12px 2px;
  list-style: none;
  cursor: pointer;
  color: #6f7c64;
  font-size: 11px;
}
.details-toggle::-webkit-details-marker {
  display: none;
}
.plan-details[open] .details-toggle .app-icon {
  transform: rotate(180deg);
}
.details-content {
  padding: 0 2px 8px;
}
.care-note {
  margin: 9px 0;
  color: #909784;
  font-size: 10px;
  line-height: 1.7;
}
.state-list {
  display: grid;
  grid-template-columns: 48px 1fr;
  gap: 8px 10px;
  margin: 14px 0 4px;
  font-size: 11px;
  line-height: 1.8;
}
.state-list dt {
  color: #6c835b;
}
.state-list dd {
  margin: 0;
  color: #7b8275;
  overflow-wrap: anywhere;
}
.plan-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 16px;
  padding-top: 15px;
}
.generate-button {
  gap: 10px;
  --el-button-bg-color: #3f6241;
  --el-button-border-color: #3f6241;
  --el-button-hover-bg-color: #527851;
  --el-button-hover-border-color: #527851;
  --el-button-active-bg-color: #345437;
  --el-button-active-border-color: #345437;
  --el-button-disabled-bg-color: #dce3d5;
  --el-button-disabled-border-color: #dce3d5;
  --el-button-disabled-text-color: #7b8b70;
}
.generate-button :deep(span) {
  gap: 12px;
}
.plan-hint {
  margin: 0;
  flex: 1;
  min-width: 120px;
  color: #8c9382;
  font-size: 10px;
  line-height: 1.7;
}
@media (max-width: 620px) {
  .plant-plan {
    padding: 14px;
  }
  .plan-stages {
    grid-template-columns: 1fr;
    gap: 12px;
  }
  .plan-stage + .plan-stage {
    padding-left: 0;
    border-left: 0;
  }
}
</style>
