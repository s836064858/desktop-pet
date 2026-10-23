<script setup lang="ts">
import { computed } from 'vue'
import type { ForgeForm } from './types'
import { FRAME_META } from './types'
import { FRAME_KEYS } from '../../../lib/spriteStudio'
import AppIcon from '../../common/AppIcon.vue'

const props = defineProps<{
  form: ForgeForm
  phrase: string
  hasDraft: boolean
  isDrafting: boolean
  isDisabled: boolean
  hasKey: boolean
}>()
const emit = defineEmits<{
  'update:form': [form: ForgeForm]
  'update:phrase': [phrase: string]
  draft: []
}>()
const stateFields = computed(() =>
  FRAME_KEYS.map((frame) => ({ frame, label: FRAME_META[frame].label })),
)

function updateField<K extends keyof ForgeForm>(key: K, value: ForgeForm[K]): void {
  emit('update:form', { ...props.form, [key]: value })
}
function updateState(frame: keyof ForgeForm['states'], value: string): void {
  updateField('states', { ...props.form.states, [frame]: value })
}
</script>
<template>
  <section>
    <h3 class="compose-title">你想养一株什么植物？</h3>
    <form class="phrase-row" @submit.prevent="$emit('draft')">
      <el-input
        :model-value="phrase"
        aria-label="想生成的植物"
        placeholder="例如：薰衣草，柔和的淡紫色花穗"
        maxlength="120"
        :disabled="isDisabled"
        @update:model-value="$emit('update:phrase', $event)"
      />
      <el-button
        class="draft-button"
        :loading="isDrafting"
        :disabled="isDisabled || !hasKey"
        native-type="submit"
        ><AppIcon name="sparkles" :size="16" />{{ hasDraft ? '重新起草' : 'AI 起草' }}</el-button
      >
    </form>
    <p class="muted compose-hint">
      {{ hasKey ? '先起草描述，确认后再生成形象。' : '先在上方配置密钥，再开始起草。' }}
    </p>
    <div v-if="hasDraft" class="plant-form">
      <h3 class="form-title">植物设定</h3>
      <div class="form-grid">
        <label class="field-label"
          ><span>名称</span
          ><el-input
            :model-value="form.name"
            maxlength="12"
            :disabled="isDisabled"
            @update:model-value="updateField('name', $event)"
        /></label>
        <label class="field-label"
          ><span>物种标识</span
          ><el-input
            :model-value="form.code"
            placeholder="如 lavender"
            :disabled="isDisabled"
            @update:model-value="updateField('code', $event)"
        /></label>
      </div>
      <label class="field-label description-field"
        ><span>外形描述</span
        ><el-input
          :model-value="form.desc"
          type="textarea"
          :rows="2"
          maxlength="120"
          :disabled="isDisabled"
          @update:model-value="updateField('desc', $event)"
      /></label>
      <details class="states-disclosure">
        <summary>
          <span><AppIcon name="leaf" :size="16" /> 六种状态描述</span><small>可逐项调整</small>
        </summary>
        <div class="state-fields">
          <label v-for="item in stateFields" :key="item.frame" class="field-label"
            ><span>{{ item.label }}</span
            ><el-input
              :model-value="form.states[item.frame]"
              type="textarea"
              :rows="2"
              maxlength="100"
              :disabled="isDisabled"
              @update:model-value="updateState(item.frame, $event)"
          /></label>
        </div>
      </details>
      <div class="form-grid interval-fields">
        <label class="field-label"
          ><span>浇水间隔 / 小时</span
          ><el-input-number
            :model-value="form.waterIntervalH"
            :min="6"
            :max="720"
            :step="24"
            :disabled="isDisabled"
            @update:model-value="updateField('waterIntervalH', $event)"
        /></label>
        <label class="field-label"
          ><span>晒太阳间隔 / 小时</span
          ><el-input-number
            :model-value="form.sunIntervalH"
            :min="6"
            :max="720"
            :step="24"
            :disabled="isDisabled"
            @update:model-value="updateField('sunIntervalH', $event)"
        /></label>
      </div>
      <p class="inline-note"><AppIcon name="info" :size="14" /> 养护间隔请按实际植物习性确认。</p>
    </div>
    <div v-else class="draft-empty">
      <AppIcon name="leaf" :size="32" />
      <p>每一株植物，都有自己的模样</p>
      <span>告诉 AI 你喜欢的植物，先为它写一份小档案。</span>
    </div>
  </section>
</template>
<style scoped>
.compose-title {
  margin: 0 0 14px;
  font-size: 20px;
  font-weight: 650;
}
.phrase-row {
  display: flex;
  gap: 10px;
}
.draft-button {
  border-color: #8ea487;
  color: #3c694e;
  gap: 6px;
}
.compose-hint {
  margin: 9px 0 0;
  font-size: 11px;
}
.plant-form {
  margin-top: 22px;
  padding-top: 20px;
  border-top: 1px solid var(--sprout-line);
}
.form-title {
  font-size: 15px;
  margin: 0 0 16px;
}
.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18px;
}
.description-field {
  margin: 16px 0;
}
.states-disclosure {
  border: 1px solid var(--sprout-line);
  border-radius: 8px;
  padding: 11px 12px;
}
.states-disclosure summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  font-size: 12px;
  list-style: none;
}
.states-disclosure summary::-webkit-details-marker {
  display: none;
}
.states-disclosure summary span {
  display: flex;
  align-items: center;
  gap: 8px;
}
.states-disclosure summary small {
  color: #86917d;
  font-size: 10px;
}
.states-disclosure summary small::after {
  content: ' ›';
}
.states-disclosure[open] summary small::after {
  content: ' ⌄';
}
.state-fields {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-top: 16px;
}
.interval-fields {
  margin: 16px 0;
}
.interval-fields .el-input-number {
  width: 100%;
}
.draft-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  color: #91a27d;
  background: #f2f4ea;
  margin-top: 24px;
  border-radius: 16px 40px 16px 40px;
}
.draft-empty p {
  font-size: 15px;
  color: #66805b;
}
.draft-empty span {
  font-size: 11px;
  padding-inline: 16px;
  text-align: center;
}
</style>
