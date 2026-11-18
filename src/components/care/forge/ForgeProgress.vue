<script setup lang="ts">
import { computed } from 'vue'
import { FRAME_KEYS } from '../../../lib/spriteFrames'
import { GROWTH_STAGE_KEYS, GROWTH_STAGE_LABELS } from '../../../lib/spriteFrames'
import type { GrowthFrameStatus } from './types'
import { FRAME_META, FRAME_STATUS_LABELS } from './types'
import AppIcon from '../../common/AppIcon.vue'

const props = defineProps<{
  name: string
  frameStatus: GrowthFrameStatus
  previewUrl?: string
  doneCount: number
  isGenerating: boolean
  hasPendingJobs: boolean
  isGenerationBlocked: boolean
}>()
const totalFrames = GROWTH_STAGE_KEYS.length * FRAME_KEYS.length
const progress = computed(() => Math.round((props.doneCount / totalFrames) * 100))
const phaseLabel = computed(() => {
  const statuses = GROWTH_STAGE_KEYS.flatMap((stage) => Object.values(props.frameStatus[stage]))
  if (statuses.includes('checking')) return '正在检查并对齐新图片'
  if (statuses.includes('running')) return '正在绘制互动状态'
  if (props.hasPendingJobs) return props.isGenerationBlocked ? '生成队列暂缓' : '互动状态排队中'
  if (props.doneCount === totalFrames) return '全部图片已就绪'
  return props.isGenerating ? '正在提交生成任务' : '还有图片待补齐'
})
</script>
<template>
  <section class="generation" aria-label="互动状态生成进度">
    <h3>{{ name ? `${name}的互动状态` : '互动状态' }}</h3>
    <p class="muted">以已确认主形象生成互动状态，每帧自动检测、对齐并复检</p>
    <div class="generation-preview">
      <img v-if="previewUrl" :src="previewUrl" :alt="name" draggable="false" />
      <div v-else class="preview-wait">
        <AppIcon name="leaf" :size="48" />
      </div>
    </div>
    <div class="generation-progress">
      <div class="progress-caption" role="status">
        <strong>{{ phaseLabel }}</strong>
        <span>{{ doneCount }} / {{ totalFrames }} 帧通过检查</span>
      </div>
      <el-progress
        aria-label="通过检查的图片比例"
        :percentage="progress"
        :show-text="false"
        :stroke-width="8"
        color="#c87955"
      />
    </div>
    <section v-for="stage in GROWTH_STAGE_KEYS" :key="stage" class="stage-progress">
      <h4 class="stage-title">{{ GROWTH_STAGE_LABELS[stage] }}</h4>
      <div class="status-grid">
        <div v-for="frame in FRAME_KEYS" :key="frame" class="frame-status">
          <span class="status-name"
            ><AppIcon :name="FRAME_META[frame].icon" :size="18" />{{
              FRAME_META[frame].label
            }}</span
          ><span class="status-value" :class="'status-' + frameStatus[stage][frame]"
            ><AppIcon
              v-if="frameStatus[stage][frame] === 'done'"
              name="check"
              :size="14"
            /><i
              v-else-if="
                frameStatus[stage][frame] === 'running' ||
                frameStatus[stage][frame] === 'checking'
              "
              class="loading-ring"
            />{{ FRAME_STATUS_LABELS[frameStatus[stage][frame] ?? 'pending'] }}</span
          >
        </div>
      </div>
    </section>
    <p class="inline-note generation-note">
      <AppIcon name="info" :size="14" />{{
        isGenerating
          ? '停止等待或关闭窗口后，已提交的任务会继续。'
          : hasPendingJobs
            ? '进度保存在云端草稿中，可刷新或稍后查看。'
            : '可补齐缺失状态，或进入预览单独重试。'
      }}
    </p>
  </section>
</template>
<style scoped>
.generation h3 {
  margin: 0;
  font-size: 20px;
  text-align: center;
}
.generation > .muted {
  text-align: center;
  margin: 8px 0 18px;
}
.generation-preview {
  display: grid;
  place-items: center;
  height: 205px;
  background: #eaf0df;
  border-radius: 50px 18px 50px 18px;
  overflow: hidden;
}
.generation-preview img {
  width: 205px;
  height: 205px;
  object-fit: contain;
}
.preview-wait {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
  color: #859a6d;
  font-size: 12px;
}
.generation-progress {
  width: 80%;
  margin: 20px auto;
}
.progress-caption {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 4px 12px;
  margin: 0 0 8px;
  font-size: 12px;
  color: var(--sprout-muted);
}
.progress-caption strong { color: #526b48; }
.progress-caption span { font-variant-numeric: tabular-nums; }
.status-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.stage-progress + .stage-progress {
  margin-top: 14px;
}
.stage-title {
  margin: 0 0 8px;
  color: #526b48;
  font-size: 12px;
}
.frame-status {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border: 1px solid #e4e6da;
  padding: 11px;
  border-radius: 7px;
  font-size: 12px;
}
.status-name,
.status-value {
  display: inline-flex;
  align-items: center;
  gap: 7px;
}
.status-name {
  color: #566e4a;
}
.status-value {
  font-size: 10px;
  color: #9a9e91;
}
.status-done {
  color: #4b855b;
}
.status-error {
  color: #b36347;
}
.status-running,
.status-checking {
  color: #b6784e;
}
.generation-note {
  margin-top: 14px;
}
.loading-ring {
  width: 12px;
  height: 12px;
  border: 1.5px solid #cbd0c1;
  border-top-color: #b6784e;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
@media (prefers-reduced-motion: reduce) {
  .loading-ring { animation: none; }
}
</style>
