<script setup lang="ts">
import AppIcon from '../../common/AppIcon.vue'

const props = defineProps<{
  message: string
  canSend: boolean
  isDisabled: boolean
  isPlanning: boolean
  isReadingReference: boolean
  isCancelling: boolean
  hasKey: boolean
  errorMessage: string
  referenceMessage: string
}>()
const emit = defineEmits<{
  'update:message': [value: string]
  send: []
  cancel: []
}>()

function send(): void {
  if (props.canSend && !props.isDisabled && props.hasKey) emit('send')
}
function onKeydown(event: KeyboardEvent): void {
  if (event.isComposing || event.key !== 'Enter' || !(event.metaKey || event.ctrlKey))
    return
  event.preventDefault()
  send()
}
</script>

<template>
  <form class="chat-composer" aria-label="植物规划输入区" @submit.prevent="send">
    <p v-if="errorMessage" class="composer-error" role="alert">{{ errorMessage }}</p>
    <p v-else-if="referenceMessage" class="reference-status" role="status">
      {{ referenceMessage }}
    </p>
    <div class="composer-surface">
      <el-input
        :model-value="message"
        type="textarea"
        :autosize="{ minRows: 2, maxRows: 4 }"
        maxlength="1000"
        show-word-limit
        aria-label="植物规划消息"
        placeholder="继续调整，或上传植物照片…"
        :disabled="isDisabled"
        @update:model-value="$emit('update:message', $event)"
        @keydown="onKeydown"
      />
      <div class="composer-toolbar">
        <div class="composer-attachment"><slot name="attachment" /></div>
        <el-button
          v-if="isPlanning || isReadingReference"
          class="stop-button"
          size="small"
          :loading="isCancelling"
          :disabled="isCancelling"
          @click="$emit('cancel')"
          ><AppIcon v-if="!isCancelling" name="stop" :size="14" />{{
            isReadingReference ? '停止读取' : '停止对话'
          }}</el-button
        >
        <el-button
          v-else
          class="send-button"
          type="primary"
          native-type="submit"
          :disabled="isDisabled || !hasKey || !canSend"
          aria-label="发送消息"
          title="发送消息（Ctrl / ⌘ + Enter）"
          ><AppIcon name="send" :size="18"
        /></el-button>
      </div>
    </div>
    <p class="composer-note">
      {{
        hasKey
          ? '原图仅用于识别与主形象，后续状态沿用已确认形象。'
          : '请先配置密钥，再开始对话。'
      }}
    </p>
  </form>
</template>

<style scoped>
.chat-composer {
  flex-shrink: 0;
  margin: 0;
  padding: 14px 0 0;
  border-top: 1px solid var(--sprout-line);
  background: #fffef9;
}
.composer-surface {
  padding: 3px 8px 8px;
  border: 1px solid #cbd0c2;
  border-radius: 11px;
  transition: border-color 0.15s;
}
.composer-surface:focus-within {
  border-color: #708967;
}
.composer-surface :deep(.el-textarea__inner) {
  padding: 9px 4px 16px;
  box-shadow: none;
  background: transparent;
  font-size: 13px;
  resize: none;
}
.composer-surface :deep(.el-textarea__inner:focus) {
  box-shadow: none;
}
.composer-surface :deep(.el-input__count) {
  right: 5px;
  bottom: 1px;
  background: transparent;
  color: #9ba48f;
  font-size: 9px;
}
.composer-toolbar {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  margin-top: 3px;
}
.composer-attachment {
  flex: 1;
  min-width: 0;
}
.send-button {
  flex-shrink: 0;
  width: 39px;
  height: 31px;
  padding: 0;
  --el-button-bg-color: #3f6241;
  --el-button-border-color: #3f6241;
  --el-button-hover-bg-color: #527851;
  --el-button-hover-border-color: #527851;
  --el-button-active-bg-color: #345437;
  --el-button-active-border-color: #345437;
  --el-button-disabled-bg-color: #dce3d5;
  --el-button-disabled-border-color: #dce3d5;
  --el-button-disabled-text-color: #8b9a80;
}
.stop-button {
  flex-shrink: 0;
}
.stop-button :deep(span) {
  gap: 5px;
}
.composer-note {
  margin: 8px 3px 0;
  color: #8a9580;
  font-size: 10px;
  line-height: 1.7;
}
.composer-error,
.reference-status {
  margin: 0 0 10px;
  padding: 8px 10px;
  border-radius: 6px;
  font-size: 11px;
  line-height: 1.7;
  overflow-wrap: anywhere;
}
.composer-error {
  max-height: 90px;
  overflow-y: auto;
  background: #fbede3;
  color: #a84d37;
}
.reference-status {
  color: #5c7a50;
  background: #f1f4e9;
}
</style>
