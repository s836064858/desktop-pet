<script setup lang="ts">
import type { ForgeForm } from './types'
import type { PlantChatMessage } from '../../../lib/plantPlan'
import ForgeChat from './ForgeChat.vue'
import ForgeChatComposer from './ForgeChatComposer.vue'
import ForgePlantPlan from './ForgePlantPlan.vue'
import ForgeReferenceUpload from './ForgeReferenceUpload.vue'

defineProps<{
  form: ForgeForm
  phrase: string
  chatMessages: PlantChatMessage[]
  planMessageId: string
  hasDraft: boolean
  canGenerate: boolean
  canSend: boolean
  canRetry: boolean
  isDrafting: boolean
  isCancelling: boolean
  isDisabled: boolean
  hasKey: boolean
  errorMessage: string
  referencePreviewUrl: string
  referenceFileName: string
  referenceDimensions: string
  referenceMessage: string
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
      :plan-message-id="planMessageId"
      :reference-preview-url="referencePreviewUrl"
      :can-retry="canRetry"
      :is-disabled="isDisabled"
      :has-key="hasKey"
      @retry="$emit('retry')"
    >
      <template #plan>
        <ForgePlantPlan
          :plan="form"
          :is-ready="hasDraft"
          :can-generate="canGenerate && hasKey"
          :is-disabled="isDisabled"
          :has-pending-changes="Boolean(phrase.trim())"
          @generate="$emit('generate')"
        />
      </template>
    </ForgeChat>
    <ForgeChatComposer
      :message="phrase"
      :can-send="canSend"
      :is-disabled="isDisabled"
      :is-planning="isDrafting"
      :is-reading-reference="isReadingReference"
      :is-cancelling="isCancelling"
      :has-key="hasKey"
      :error-message="errorMessage"
      :reference-message="referenceMessage"
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
