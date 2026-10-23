<script setup lang="ts">
import { computed } from 'vue'
import { FRAME_KEYS } from '../../../lib/spriteStudio'
import type { FrameName } from '../../../lib/speciesArt'
import type { FrameStatus } from './types'
import { FRAME_META, FRAME_STATUS_LABELS } from './types'
import AppIcon from '../../common/AppIcon.vue'

const props = defineProps<{
  name: string
  frameStatus: Record<FrameName, FrameStatus>
  previewUrl?: string
  doneCount: number
  isGenerating: boolean
}>()
const progress = computed(() => Math.round((props.doneCount / FRAME_KEYS.length) * 100))
</script>
<template>
  <section class="generation" aria-live="polite">
    <h3>{{ isGenerating ? '正在绘制你的' : '你的植物形象' }}{{ name }}</h3>
    <p class="muted">先生成基础形象，再依次生成其余状态</p>
    <div class="generation-preview">
      <img v-if="previewUrl" :src="previewUrl" :alt="name" draggable="false" />
      <div v-else class="preview-wait">
        <AppIcon name="leaf" :size="48" /><span>{{
          isGenerating ? '第一片叶子，正在生长…' : '等待生成基础形象'
        }}</span>
      </div>
    </div>
    <div class="generation-progress">
      <el-progress :percentage="progress" :show-text="false" :stroke-width="8" color="#c87955" />
      <p>已完成 {{ doneCount }} / 6 帧</p>
    </div>
    <div class="status-grid">
      <div v-for="frame in FRAME_KEYS" :key="frame" class="frame-status">
        <span class="status-name"
          ><AppIcon :name="FRAME_META[frame].icon" :size="18" />{{ FRAME_META[frame].label }}</span
        ><span class="status-value" :class="'status-' + frameStatus[frame]"
          ><AppIcon v-if="frameStatus[frame] === 'done'" name="check" :size="14" /><i
            v-else-if="frameStatus[frame] === 'running'"
            class="loading-ring"
          />{{ FRAME_STATUS_LABELS[frameStatus[frame]] }}</span
        >
      </div>
    </div>
    <p class="inline-note generation-note">
      <AppIcon name="info" :size="14" />{{
        isGenerating
          ? '生成需要一些时间，请保持窗口打开。'
          : '已完成的图片会保留，失败帧可在预览中单独重试。'
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
.generation-progress p {
  margin: 8px 0 0;
  text-align: center;
  font-size: 11px;
  color: var(--sprout-muted);
}
.status-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
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
.status-running {
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
</style>
