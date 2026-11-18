<script setup lang="ts">
import { computed, onMounted, onUnmounted, useTemplateRef, watch } from 'vue'
import type { PlantChatMessage } from '../../../lib/plantPlan'
import type { ChatProgress } from './types'
import AppIcon from '../../common/AppIcon.vue'

const props = defineProps<{
  messages: PlantChatMessage[]
  progress: ChatProgress | null
  canRetry: boolean
  isDisabled: boolean
}>()
defineEmits<{ retry: [] }>()
const history = useTemplateRef<HTMLElement>('history')
const latest = computed(() => props.messages.at(-1))
let resizeObserver: ResizeObserver | null = null
let shouldFollowLatest = true

function scrollToLatest(): void {
  const element = history.value
  shouldFollowLatest = true
  if (element) element.scrollTop = element.scrollHeight
}

function onScroll(): void {
  const element = history.value
  if (element)
    shouldFollowLatest =
      element.scrollHeight - element.clientHeight - element.scrollTop < 40
}

function onResize(): void {
  if (shouldFollowLatest) scrollToLatest()
}

watch(
  [() => latest.value?.id, () => latest.value?.status, () => props.progress?.label],
  ([id], [previousId]) => {
    const isNewUserMessage = id !== previousId && latest.value?.role === 'user'
    if (isNewUserMessage || shouldFollowLatest) scrollToLatest()
  },
  { flush: 'post' },
)
onMounted(() => {
  resizeObserver = new ResizeObserver(onResize)
  if (history.value) resizeObserver.observe(history.value)
  scrollToLatest()
})
onUnmounted(() => resizeObserver?.disconnect())
</script>

<template>
  <section
    ref="history"
    class="chat-transcript"
    :class="{ 'is-empty': !messages.length && !progress }"
    aria-label="植物规划对话"
    @scroll="onScroll"
  >
    <div v-if="!messages.length && !progress" class="chat-welcome">
      <span class="welcome-icon"><AppIcon name="leaf" :size="28" /></span>
      <h3 class="welcome-title">你想做一株什么植物？</h3>
      <p class="welcome-description">
        输入植物名，或描述它的叶子、花色和株形。<br />也可以添加一张照片作参考。
      </p>
      <span class="welcome-hint">图片支持 PNG / JPEG / WebP · ≤10MB</span>
    </div>
    <ol v-else class="chat-history" aria-live="polite" aria-relevant="additions text">
      <li v-for="entry in messages" :key="entry.id" :class="['chat-entry', entry.role]">
        <span v-if="entry.role === 'assistant'" class="assistant-avatar"
          ><AppIcon name="leaf" :size="20"
        /></span>
        <div class="message-content">
          <span v-if="entry.role === 'assistant'" class="chat-role">芽伴</span>
          <div class="message-bubble" :class="{ 'question-bubble': entry.needsClarification }">
            <span v-if="entry.needsClarification" class="question-label">待补充信息</span>
            <p class="chat-text">{{ entry.text }}</p>
            <p v-if="entry.hasImage" class="chat-attachment">
              <AppIcon name="image" :size="13" />已附植物参考图
            </p>
          </div>
          <div v-if="entry.status === 'error'" class="chat-status" role="alert">
            <span>{{ entry.errorMessage || '本轮未完成，内容已保留' }}</span>
            <el-button
              v-if="entry.id === latest?.id && canRetry"
              text
              size="small"
              :disabled="isDisabled"
              @click="$emit('retry')"
              ><AppIcon name="refresh" :size="12" />重试本轮</el-button
            >
          </div>
          <slot v-if="entry.role === 'assistant'" name="plan" :entry="entry" />
        </div>
      </li>
      <li v-if="progress" class="chat-entry assistant" key="chat-progress">
        <span class="assistant-avatar"><AppIcon name="leaf" :size="20" /></span>
        <div class="progress-bubble" role="status">
          <span v-if="progress.isActive" class="progress-ring" aria-hidden="true" />
          <div>
            <strong>{{ progress.label }}</strong>
            <p v-if="progress.description">{{ progress.description }}</p>
          </div>
        </div>
      </li>
    </ol>
  </section>
</template>

<style scoped>
.chat-transcript {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
  padding: 12px 5px 22px 0;
}
.chat-welcome {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  min-height: 0;
  padding: 16px 15px;
  text-align: center;
}
.chat-transcript.is-empty {
  display: flex;
}
.welcome-icon {
  display: grid;
  place-items: center;
  width: 56px;
  height: 56px;
  margin-bottom: 18px;
  border-radius: 50%;
  background: #edf1e5;
  color: #789267;
}
.welcome-title {
  margin: 0;
  color: #456746;
  font-size: 17px;
  font-weight: 600;
}
.welcome-description {
  margin: 12px 0;
  color: #84917b;
  font-size: 12px;
  line-height: 2;
}
.welcome-hint {
  color: #9ba48f;
  font-size: 10px;
}
.chat-history {
  display: flex;
  flex-direction: column;
  gap: 22px;
  padding: 0;
  margin: 0;
  list-style: none;
}
.chat-entry {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  min-width: 0;
}
.chat-entry.user {
  align-self: flex-end;
  max-width: 80%;
}
.chat-entry.assistant {
  padding-right: 5px;
}
.assistant-avatar {
  display: grid;
  place-items: center;
  flex: 0 0 30px;
  height: 30px;
  border-radius: 50%;
  background: #eaf0e2;
  color: #779365;
}
.message-content {
  min-width: 0;
  flex: 1;
}
.chat-role {
  display: block;
  margin: 4px 0 8px;
  color: #4f7044;
  font-size: 12px;
  font-weight: 600;
}
.message-bubble {
  padding: 10px 13px;
  background: #f4f5ed;
  border-radius: 10px;
}
.user .message-bubble {
  background: #e8efdf;
}
.question-bubble {
  border-left: 3px solid #9bac87;
}
.question-label {
  display: block;
  color: #586f4c;
  font-size: 11px;
  font-weight: 600;
}
.chat-text {
  margin: 0;
  color: #4f6548;
  font-size: 13px;
  line-height: 1.9;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.chat-attachment {
  display: flex;
  align-items: center;
  gap: 5px;
  margin: 7px 0 0;
  color: #7e8f70;
  font-size: 10px;
}
.chat-status {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin: 5px 0 0;
  color: #a84d37;
  font-size: 11px;
}
.chat-status :deep(.el-button) {
  padding: 3px;
  height: auto;
  color: #658653;
}
.chat-status :deep(.el-button > span) {
  gap: 5px;
}
.progress-bubble {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 13px;
  border: 1px solid #dbe4d3;
  border-radius: 10px;
  background: #f0f4eb;
  color: #4f6548;
  font-size: 12px;
}
.progress-bubble p {
  margin: 4px 0 0;
  font-size: 11px;
}
.progress-ring {
  width: 13px;
  height: 13px;
  flex: none;
  border: 2px solid #c0ceb6;
  border-top-color: #547748;
  border-radius: 50%;
  animation: progress-spin 0.9s linear infinite;
}
@keyframes progress-spin {
  to { transform: rotate(360deg); }
}
@media (prefers-reduced-motion: reduce) {
  .progress-ring { animation: none; }
}
@media (max-width: 620px) {
  .chat-entry.assistant {
    padding-right: 0;
    gap: 7px;
  }
  .assistant-avatar {
    flex-basis: 25px;
    height: 25px;
  }
  .chat-entry.user {
    max-width: 90%;
  }
}
</style>
