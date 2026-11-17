<script setup lang="ts">
import { shallowRef } from 'vue'
import { FRAME_KEYS } from '../../../lib/spriteFrames'
import type { FrameMap, FrameName } from '../../../lib/spriteFrames'
import { FRAME_META } from './types'
defineProps<{ frameUrls: FrameMap<string>; stageLabel: string }>()
const selectedFrame = shallowRef<FrameName>('idle')
const shouldOverlayIdle = shallowRef(false)
</script>

<template>
  <section class="frame-comparison" aria-label="固定基线切换预览">
    <div class="comparison-art">
      <img
        v-if="shouldOverlayIdle && selectedFrame !== 'idle' && frameUrls.idle"
        class="comparison-ghost"
        :src="frameUrls.idle"
        alt="基础形象对照"
        draggable="false"
      />
      <img
        v-if="frameUrls[selectedFrame]"
        :src="frameUrls[selectedFrame]"
        :alt="`${stageLabel}·${FRAME_META[selectedFrame].label}`"
        draggable="false"
      />
      <span v-else class="comparison-empty">该状态尚未生成</span>
      <span class="comparison-center" /><span class="comparison-foot" />
    </div>
    <div class="comparison-controls">
      <p class="comparison-caption">状态预览 · 对齐由系统自动完成，可自由切换查看</p>
      <div class="comparison-states" aria-label="切换互动状态">
        <button
          v-for="frame in FRAME_KEYS"
          :key="frame"
          type="button"
          :aria-pressed="selectedFrame === frame"
          @click="selectedFrame = frame"
        >
          {{ FRAME_META[frame].label }}
        </button>
      </div>
      <el-checkbox v-model="shouldOverlayIdle">叠加基础形象对照</el-checkbox>
    </div>
  </section>
</template>

<style scoped>
.frame-comparison {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 18px;
  padding: 12px;
  background: #f2f4ea;
  border-radius: 10px;
}
.comparison-art {
  position: relative;
  flex: 0 0 160px;
  width: 160px;
  height: 160px;
  background: #fffef9;
  overflow: hidden;
}
.comparison-art img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.comparison-ghost {
  opacity: 0.3;
}
.comparison-center {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 50%;
  border-left: 1px dashed #317caa;
  pointer-events: none;
}
.comparison-foot {
  position: absolute;
  left: 0;
  right: 0;
  top: 95%;
  border-top: 1px dashed #c87955;
  pointer-events: none;
}
.comparison-empty {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: #7b8275;
  font-size: 11px;
}
.comparison-controls {
  flex: 1;
  min-width: 0;
}
.comparison-caption {
  margin: 0 0 12px;
  color: #526b48;
  font-size: 11px;
  line-height: 1.7;
}
.comparison-states {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.comparison-states button {
  border: 1px solid var(--sprout-line);
  border-radius: 4px;
  padding: 5px 8px;
  background: #fffef9;
  color: #6b7863;
  font: inherit;
  font-size: 10px;
  cursor: pointer;
}
.comparison-states button[aria-pressed='true'] {
  color: #366547;
  border-color: #69866a;
}
.comparison-states button:focus-visible {
  outline: 2px solid #69866a;
  outline-offset: 2px;
}
@media (max-width: 500px) {
  .frame-comparison {
    flex-direction: column;
  }
}
</style>
