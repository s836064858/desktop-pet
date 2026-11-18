<script setup lang="ts">
import AppIcon from '../../common/AppIcon.vue'

const props = defineProps<{
  message: string
  placeholder: string
  canSend: boolean
  isDisabled: boolean
  isPlanning: boolean
  isReadingReference: boolean
  errorMessage: string
}>()
const emit = defineEmits<{
  'update:message': [value: string]
  send: []
  cancel: []
}>()

function send(): void {
  if (props.canSend && !props.isDisabled) emit('send')
}
function onKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Enter' || event.shiftKey || event.isComposing || event.keyCode === 229)
    return
  event.preventDefault()
  if (!event.repeat) send()
}
</script>

<template>
  <form class="chat-composer" aria-label="植物规划输入区" @submit.prevent="send">
    <p v-if="errorMessage" class="composer-error" role="alert">{{ errorMessage }}</p>
    <div class="composer-surface">
      <el-input
        :model-value="message"
        type="textarea"
        :autosize="{ minRows: 2, maxRows: 4 }"
        maxlength="1000"
        show-word-limit
        aria-label="植物规划消息"
        :placeholder="placeholder"
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
          @click="$emit('cancel')"
          ><AppIcon name="stop" :size="14" />{{
            isReadingReference ? '停止处理' : '停止等待'
          }}</el-button
        >
        <el-button
          v-else
          class="send-button"
          type="primary"
          native-type="submit"
          :disabled="isDisabled || !canSend"
          aria-label="发送消息"
          title="回车发送，Shift + 回车换行"
          ><AppIcon name="send" :size="18"
        /></el-button>
      </div>
    </div>
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
.composer-error {
  margin: 0 0 10px;
  padding: 8px 10px;
  border-radius: 6px;
  font-size: 11px;
  line-height: 1.7;
  overflow-wrap: anywhere;
  max-height: 90px;
  overflow-y: auto;
  background: #fbede3;
  color: #a84d37;
}
</style>
