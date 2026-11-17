<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import {
  FRAME_KEYS,
  GROWTH_STAGE_KEYS,
  GROWTH_STAGE_LABELS,
} from '../../../lib/spriteFrames'
import type { FrameTarget, GrowthFrames } from '../../../lib/spriteFrames'
import type { GrowthStage } from '../../../lib/growth'
import type { GrowthFrameStatus } from './types'
import { FRAME_META, FRAME_STATUS_LABELS } from './types'
import AppIcon from '../../common/AppIcon.vue'
import ForgeFramePreview from './ForgeFramePreview.vue'
const props = defineProps<{
  frameUrls: GrowthFrames<string>
  frameStatus: GrowthFrameStatus
  frameErrors: GrowthFrames<string>
  checkedCount: number
  regeneratingTarget: FrameTarget | null
  isDisabled: boolean
}>()
defineEmits<{ regenerate: [target: FrameTarget] }>()
const selectedStage = shallowRef<GrowthStage>('juvenile')
const visibleUrls = computed(() => props.frameUrls[selectedStage.value])
const visibleStatus = computed(() => props.frameStatus[selectedStage.value])
const regeneratingFrame = computed(() =>
  props.regeneratingTarget?.stage === selectedStage.value
    ? props.regeneratingTarget.frame
    : null,
)
</script>
<template>
  <section>
    <h3 class="gallery-title">三个阶段，十八种模样</h3>
    <p class="muted gallery-hint">
      自动检查通过 {{ checkedCount }} / 18 帧。花盆与脚底由系统自动对齐，无需逐帧校验。
    </p>
    <nav class="stage-tabs" aria-label="预览成长阶段">
      <button
        v-for="stage in GROWTH_STAGE_KEYS"
        :key="stage"
        type="button"
        :aria-pressed="selectedStage === stage"
        @click="selectedStage = stage"
      >
        {{ GROWTH_STAGE_LABELS[stage] }}
      </button>
    </nav>
    <ForgeFramePreview
      :frame-urls="visibleUrls"
      :stage-label="GROWTH_STAGE_LABELS[selectedStage]"
    />
    <div class="gallery-grid">
      <article v-for="frame in FRAME_KEYS" :key="frame" class="frame-tile">
        <div class="frame-art">
          <img
            v-if="visibleUrls[frame]"
            :src="visibleUrls[frame]"
            :alt="`${GROWTH_STAGE_LABELS[selectedStage]}·${FRAME_META[frame].label}`"
            draggable="false"
          /><span v-else>{{
            FRAME_STATUS_LABELS[visibleStatus[frame] ?? 'pending']
          }}</span>
          <span
            v-if="visibleUrls[frame] && visibleStatus[frame] === 'error'"
            class="frame-error"
            >重生成失败，可重试</span
          >
        </div>
        <h4>{{ FRAME_META[frame].label }}</h4>
        <p v-if="visibleStatus[frame] === 'done'" class="frame-check">自动检查通过</p>
        <p v-if="frameErrors[selectedStage][frame]" class="frame-issue" role="alert">
          {{ frameErrors[selectedStage][frame] }}
        </p>
        <el-button
          text
          size="small"
          :loading="regeneratingFrame === frame"
          :disabled="isDisabled"
          @click="$emit('regenerate', { stage: selectedStage, frame })"
          ><AppIcon v-if="regeneratingFrame !== frame" name="refresh" :size="13" />{{
            visibleStatus[frame] === 'error' ? '重试' : '重生成'
          }}</el-button
        >
      </article>
    </div>
    <p class="inline-note gallery-note">
      <AppIcon name="info" :size="14" />保存后，可直接在领养页选择它。
    </p>
    <p class="muted gallery-footnote">
      重生成基础形象后，需要重新确认，并补齐该阶段的五种状态。
    </p>
  </section>
</template>
<style scoped>
.gallery-title {
  margin: 0;
  font-size: 20px;
  text-align: center;
}
.gallery-hint {
  text-align: center;
  margin: 8px 0 20px;
}
.gallery-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}
.stage-tabs {
  display: flex;
  gap: 6px;
  padding: 4px;
  margin-bottom: 16px;
  background: #eef1e6;
  border-radius: 8px;
}
.stage-tabs button {
  flex: 1;
  padding: 9px;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: #6b7863;
  cursor: pointer;
  font: inherit;
  font-size: 12px;
}
.stage-tabs button[aria-pressed='true'] {
  background: #fffef9;
  color: #366547;
  box-shadow: 0 1px 3px #324a2510;
  font-weight: 600;
}
.stage-tabs button:focus-visible {
  outline: 2px solid #69866a;
  outline-offset: 2px;
}
.frame-error {
  position: absolute;
  bottom: 5px;
  padding: 2px 5px;
  color: #b36347;
  background: #fffef9;
  font-size: 10px;
}
.frame-tile {
  border: 1px solid #e4e6d8;
  border-radius: 10px;
  background: #fffef9;
  overflow: hidden;
  text-align: center;
}
.frame-art {
  position: relative;
  display: grid;
  place-items: center;
  background: #eef1e6;
  height: 128px;
  overflow: hidden;
  color: #9a9f90;
  font-size: 11px;
}
.frame-art img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.frame-tile h4 {
  font-size: 12px;
  margin: 9px 0 2px;
  font-weight: 500;
}
.frame-tile .el-button {
  color: #6b8860;
  gap: 5px;
  margin-bottom: 4px;
  font-size: 11px;
}
.gallery-note {
  margin-top: 16px;
}
.gallery-footnote {
  margin: 9px 0 0;
  font-size: 10px;
}
.frame-check {
  margin: 5px 6px;
  color: #438866;
  font-size: 10px;
}
.frame-issue {
  margin: 5px 8px;
  color: #b36347;
  font-size: 10px;
  line-height: 1.7;
}
@media (max-width: 500px) {
  .gallery-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
