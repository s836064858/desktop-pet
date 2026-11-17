<script setup lang="ts">
import { onMounted, onUnmounted, useTemplateRef, watch } from 'vue'
import type { PlantChatMessage } from '../../../lib/plantPlan'
import AppIcon from '../../common/AppIcon.vue'

const props = defineProps<{
  messages: PlantChatMessage[]
  planMessageId: string
  referencePreviewUrl: string
  canRetry: boolean
  isDisabled: boolean
  hasKey: boolean
}>()
defineEmits<{ retry: [] }>()
const history = useTemplateRef<HTMLElement>('history')
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

watch([() => props.messages.at(-1), () => props.planMessageId], scrollToLatest, {
  flush: 'post',
})
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
    :class="{ 'is-empty': !messages.length }"
    aria-label="植物规划对话"
    @scroll="onScroll"
  >
    <div v-if="!messages.length" class="chat-welcome">
      <span class="welcome-icon"><AppIcon name="leaf" :size="28" /></span>
      <h3 class="welcome-title">从一张照片，或一个想法开始</h3>
      <p class="welcome-description">
        告诉我你想养什么，或直接上传植物照片。<br />我们一起确定它的外形、成长形态和养护习性。
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
          <div class="message-bubble">
            <p class="chat-text">{{ entry.text }}</p>
            <img
              v-if="
                entry.hasImage &&
                entry.imagePreviewUrl &&
                entry.imagePreviewUrl === referencePreviewUrl
              "
              class="message-photo"
              :src="referencePreviewUrl"
              alt="这条消息附带的植物参考图"
              draggable="false"
            />
            <p v-else-if="entry.hasImage" class="chat-attachment">
              <AppIcon name="image" :size="13" />已附植物参考图
            </p>
          </div>
          <div v-if="entry.status !== 'done'" class="chat-status">
            <span>{{
              entry.status === 'pending' ? '芽伴正在整理…' : '本轮未完成，内容已保留'
            }}</span>
            <el-button
              v-if="entry.id === messages.at(-1)?.id && canRetry"
              text
              size="small"
              :disabled="isDisabled || !hasKey"
              @click="$emit('retry')"
              ><AppIcon name="refresh" :size="12" />重试本轮</el-button
            >
          </div>
          <slot
            v-if="entry.id === planMessageId && entry.role === 'assistant'"
            name="plan"
          />
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
.chat-text {
  margin: 0;
  color: #4f6548;
  font-size: 13px;
  line-height: 1.9;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.message-photo {
  display: block;
  width: 230px;
  max-width: 100%;
  max-height: 160px;
  object-fit: contain;
  object-position: left center;
  margin-top: 10px;
  border-radius: 7px;
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
  color: #939d86;
  font-size: 10px;
}
.chat-status :deep(.el-button) {
  padding: 3px;
  height: auto;
  color: #658653;
}
.chat-status :deep(.el-button > span) {
  gap: 5px;
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
