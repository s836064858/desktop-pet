<script setup lang="ts">
import type { ChatProgress } from './types'
import type { PlantChatMessage } from '../../../lib/plantPlan'
import ForgeChat from './ForgeChat.vue'
import ForgeChatComposer from './ForgeChatComposer.vue'
import ForgePlantPlan from './ForgePlantPlan.vue'
import ForgeReferenceUpload from './ForgeReferenceUpload.vue'

defineProps<{
  phrase: string
  chatMessages: PlantChatMessage[]
  planMessageId: string
  chatProgress: ChatProgress | null
  hasDraft: boolean
  canGenerate: boolean
  canSend: boolean
  canRetry: boolean
  isDrafting: boolean
  isDisabled: boolean
  errorMessage: string
  referencePreviewUrl: string
  referenceFileName: string
  referenceDimensions: string
  isReadingReference: boolean
}>()
defineEmits<{
  'update:phrase': [phrase: string]
  draft: []
  retry: []
  generate: []
  cancel: []
  'select-reference': [file: File]
  'remove-reference': []
}>()
</script>

<template>
  <section class="forge-compose">
    <ForgeChat
      :messages="chatMessages"
      :progress="chatProgress"
      :can-retry="canRetry"
      :is-disabled="isDisabled"
      @retry="$emit('retry')"
    >
      <template #plan="{ entry }">
        <ForgePlantPlan
          v-if="entry.plan"
          :plan="entry.plan"
          :is-latest="entry.id === planMessageId"
          :is-ready="hasDraft"
          :can-generate="canGenerate"
          :is-disabled="isDisabled"
          :has-pending-changes="Boolean(phrase.trim())"
          @generate="$emit('generate')"
        />
      </template>
    </ForgeChat>
    <ForgeChatComposer
      :message="phrase"
      :placeholder="chatMessages.at(-1)?.needsClarification ? '直接输入补充信息…' : '输入植物名称、描述或修改意见…'"
      :can-send="canSend"
      :is-disabled="isDisabled"
      :is-planning="isDrafting || Boolean(chatProgress?.isActive)"
      :is-reading-reference="isReadingReference"
      :error-message="errorMessage"
      @update:message="$emit('update:phrase', $event)"
      @send="$emit('draft')"
      @cancel="$emit('cancel')"
    >
      <template #attachment>
        <ForgeReferenceUpload
          :preview-url="referencePreviewUrl"
          :file-name="referenceFileName"
          :dimensions="referenceDimensions"
          :is-disabled="isDisabled"
          :is-loading="isReadingReference"
          @select="$emit('select-reference', $event)"
          @remove="$emit('remove-reference')"
        />
      </template>
    </ForgeChatComposer>
  </section>
</template>

<style scoped>
.forge-compose {
  display: flex;
  flex: 1;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
}
</style>
