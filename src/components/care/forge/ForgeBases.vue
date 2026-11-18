<script setup lang="ts">
import { GROWTH_STAGE_KEYS, GROWTH_STAGE_LABELS } from '../../../lib/spriteFrames'
import type { GrowthFrames, FrameTarget } from '../../../lib/spriteFrames'
import type { GrowthStage } from '../../../lib/growth'
import type { AiDraft } from '../../../lib/aiService'
import type { GrowthFrameStatus } from './types'
import { FRAME_STATUS_LABELS } from './types'
import AppIcon from '../../common/AppIcon.vue'

defineProps<{
  frameUrls: GrowthFrames<string>
  frameStatus: GrowthFrameStatus
  frameErrors: GrowthFrames<string>
  confirmedBases: Record<GrowthStage, boolean>
  isDisabled: boolean
  isPaused: boolean
  uploadRetries: AiDraft['uploadRetries']
}>()
defineEmits<{
  confirm: [stage: GrowthStage]
  regenerate: [target: FrameTarget]
}>()
</script>

<template>
  <section aria-label="确认三阶段主形象">
    <h3 class="bases-title">先看看，它长大的样子</h3>
    <p class="muted bases-hint">系统自动检查并对齐花盆与脚底；你只需确认三阶段的造型。</p>
    <div class="bases-grid">
      <article
        v-for="stage in GROWTH_STAGE_KEYS"
        :key="stage"
        class="base-card"
        :class="{ 'is-confirmed': confirmedBases[stage] }"
      >
        <h4 class="base-title">{{ GROWTH_STAGE_LABELS[stage] }}</h4>
        <div
          class="base-art"
          :aria-busy="
            frameStatus[stage].idle === 'running' ||
            frameStatus[stage].idle === 'checking'
          "
        >
          <img
            v-if="frameUrls[stage].idle"
            :src="frameUrls[stage].idle"
            :alt="`${GROWTH_STAGE_LABELS[stage]}基础形象`"
            draggable="false"
          />
          <AppIcon v-else name="leaf" :size="36" />
          <span
            v-if="frameStatus[stage].idle !== 'done'"
            class="base-status"
            role="status"
            >{{ FRAME_STATUS_LABELS[frameStatus[stage].idle ?? 'pending'] }}</span
          >
        </div>
        <el-button
          class="base-confirm"
          :type="confirmedBases[stage] ? 'success' : 'primary'"
          plain
          :disabled="
            isDisabled || frameStatus[stage].idle !== 'done' || confirmedBases[stage]
          "
          @click="$emit('confirm', stage)"
        >
          <AppIcon v-if="confirmedBases[stage]" name="check" :size="14" />{{
            confirmedBases[stage]
              ? '已确认'
              : frameStatus[stage].idle === 'done'
                ? '确认这个形象'
                : '等待自动检查'
          }}
        </el-button>
        <p v-if="frameStatus[stage].idle === 'done'" class="base-check">自动检查通过</p>
        <p v-if="frameErrors[stage].idle" class="base-error" role="alert">
          {{ frameErrors[stage].idle }}
        </p>
        <el-button
          text
          size="small"
          :loading="
            frameStatus[stage].idle === 'running' ||
            frameStatus[stage].idle === 'checking'
          "
          :disabled="isDisabled || (isPaused && !uploadRetries[`${stage}:idle`])"
          @click="$emit('regenerate', { stage, frame: 'idle' })"
          >{{
            uploadRetries[`${stage}:idle`]
              ? '重试上传'
              : frameStatus[stage].idle === 'error'
              ? '重试'
              : frameUrls[stage].idle
                ? '重新绘制'
                : '生成形象'
          }}</el-button
        >
      </article>
    </div>
    <p class="inline-note bases-note">
      <AppIcon
        name="info"
        :size="14"
      />选择你喜欢的三阶段造型即可。重新绘制某阶段基础形象，会清除该阶段旧的互动状态。
    </p>
  </section>
</template>

<style scoped>
.bases-title {
  margin: 0;
  font-size: 20px;
  text-align: center;
}
.bases-hint {
  margin: 8px 0 20px;
  font-size: 12px;
  text-align: center;
  line-height: 1.7;
}
.bases-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}
.base-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  overflow: hidden;
  border: 1px solid var(--sprout-line);
  border-radius: 10px;
  background: #fffef9;
}
.base-card.is-confirmed {
  border-color: #7e9b6b;
}
.base-title {
  margin: 14px 0 8px;
  color: #526b48;
  font-size: 13px;
}
.base-art {
  position: relative;
  display: grid;
  place-items: center;
  width: 100%;
  height: 160px;
  background: #eef1e6;
  color: #91a27d;
}
.base-art img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.base-status {
  position: absolute;
  bottom: 8px;
  padding: 3px 8px;
  border-radius: 4px;
  background: #fffef9;
  color: var(--sprout-muted);
  font-size: 11px;
}
.base-confirm {
  margin: 12px 6px 4px;
  font-size: 11px;
}
.base-card > .el-button + .el-button {
  margin-left: 0;
  margin-bottom: 5px;
}
.bases-note {
  margin-top: 16px;
}
.base-check {
  margin: 4px 6px;
  color: #438866;
  font-size: 10px;
}
.base-error {
  margin: 6px 10px;
  color: #b36347;
  font-size: 10px;
  line-height: 1.7;
}
@media (max-width: 500px) {
  .bases-grid {
    gap: 6px;
  }
  .base-art {
    height: 125px;
  }
  .base-confirm {
    padding-inline: 6px;
    font-size: 10px;
  }
}
</style>
