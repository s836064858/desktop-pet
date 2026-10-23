<script setup lang="ts">
import { FRAME_KEYS } from '../../../lib/spriteStudio'
import type { FrameName } from '../../../lib/speciesArt'
import type { FrameStatus } from './types'
import { FRAME_META, FRAME_STATUS_LABELS } from './types'
import AppIcon from '../../common/AppIcon.vue'
defineProps<{
  frameUrls: Partial<Record<FrameName, string>>
  frameStatus: Record<FrameName, FrameStatus>
  regeneratingFrame: FrameName | null
  isDisabled: boolean
}>()
defineEmits<{ regenerate: [frame: FrameName] }>()
</script>
<template>
  <section>
    <h3 class="gallery-title">看看它的六种模样</h3>
    <p class="muted gallery-hint">确认形象一致、表情清楚后，即可加入物种库。</p>
    <div class="gallery-grid">
      <article v-for="frame in FRAME_KEYS" :key="frame" class="frame-tile">
        <div class="frame-art">
          <img
            v-if="frameUrls[frame]"
            :src="frameUrls[frame]"
            :alt="FRAME_META[frame].label"
            draggable="false"
          /><span v-else>{{ FRAME_STATUS_LABELS[frameStatus[frame]] }}</span>
        </div>
        <h4>{{ FRAME_META[frame].label }}</h4>
        <el-button
          text
          size="small"
          :loading="regeneratingFrame === frame"
          :disabled="isDisabled || (frame !== 'idle' && !frameUrls.idle)"
          @click="$emit('regenerate', frame)"
          ><AppIcon v-if="regeneratingFrame !== frame" name="refresh" :size="13" />{{
            frameStatus[frame] === 'error' ? '重试' : '重生成'
          }}</el-button
        >
      </article>
    </div>
    <p class="inline-note gallery-note">
      <AppIcon name="info" :size="14" />保存后，可直接在领养页选择它。
    </p>
    <p class="muted gallery-footnote">重生成基础形象后，请再检查其他状态是否保持一致。</p>
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
@media (max-width: 500px) {
  .gallery-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
