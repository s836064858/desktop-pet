<script setup lang="ts">
import { useTemplateRef } from 'vue'
import { PLANT_REFERENCE_ACCEPT } from '../../../lib/plantReference'
import AppIcon from '../../common/AppIcon.vue'

const props = defineProps<{
  previewUrl: string
  fileName: string
  dimensions: string
  isDisabled: boolean
  isLoading: boolean
}>()
const emit = defineEmits<{ select: [file: File]; remove: [] }>()
const fileInput = useTemplateRef<HTMLInputElement>('fileInput')

function openPicker(): void {
  if (!props.isDisabled) fileInput.value?.click()
}
function onFileChange(event: Event): void {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file || props.isDisabled) return
  emit('select', file)
}
</script>

<template>
  <div class="reference-attachment" aria-label="植物图片附件" :aria-busy="isLoading">
    <input
      ref="fileInput"
      type="file"
      :accept="PLANT_REFERENCE_ACCEPT"
      :disabled="isDisabled"
      aria-label="选择植物参考图片"
      hidden
      @change="onFileChange"
    />
    <div v-if="previewUrl" class="attachment-chip">
      <img
        class="attachment-preview"
        :src="previewUrl"
        alt="当前植物参考图"
        draggable="false"
      />
      <div class="attachment-info">
        <span class="attachment-name" :title="fileName">{{ fileName }}</span
        ><small>{{ dimensions }} · 当前参考</small>
      </div>
      <el-button
        class="remove-attachment"
        text
        circle
        size="small"
        :disabled="isDisabled"
        aria-label="移除植物参考图"
        @click="$emit('remove')"
        ><AppIcon name="close" :size="14"
      /></el-button>
    </div>
    <el-button
      class="add-attachment"
      text
      size="small"
      :disabled="isDisabled"
      :loading="isLoading"
      title="PNG / JPEG / WebP · 单张 ≤10MB、1600万像素；更换或移除会清除已生成图片"
      @click="openPicker"
      ><AppIcon name="image" :size="18" />{{
        isLoading ? '读取图片…' : previewUrl ? '更换图片' : '添加图片'
      }}</el-button
    >
  </div>
</template>

<style scoped>
.reference-attachment {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 10px;
  min-width: 0;
}
.attachment-chip {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  max-width: 250px;
  padding: 5px 6px;
  border: 1px solid #e1e6d8;
  border-radius: 7px;
  background: #f3f5ed;
}
.attachment-preview {
  flex-shrink: 0;
  width: 30px;
  height: 30px;
  border-radius: 4px;
  object-fit: cover;
}
.attachment-info {
  display: grid;
  min-width: 0;
  gap: 3px;
}
.attachment-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #607454;
  font-size: 10px;
}
.attachment-info small {
  color: #8c9681;
  font-size: 9px;
}
.add-attachment {
  color: #6e875e;
  padding: 5px 3px;
}
.add-attachment :deep(span) {
  gap: 7px;
}
.remove-attachment {
  flex-shrink: 0;
  color: #8b9680;
}
</style>
