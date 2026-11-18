<script setup lang="ts">
import { ElButton, ElDialog, ElInput } from 'element-plus'
import { shallowRef } from 'vue'

const props = defineProps<{ initialLabel: string; isPending: boolean; errorMessage: string }>()
const emit = defineEmits<{ close: []; save: [label: string] }>()
const label = shallowRef(props.initialLabel)

function save(): void {
  if (!props.isPending) emit('save', label.value.trim())
}
</script>

<template>
  <ElDialog
    :model-value="true"
    title="编辑邀请备注"
    width="min(440px, calc(100vw - 32px))"
    append-to-body
    :show-close="!isPending"
    :close-on-press-escape="!isPending"
    :close-on-click-modal="false"
    @close="$emit('close')"
  >
    <form @submit.prevent="save">
      <ElInput v-model="label" maxlength="48" show-word-limit aria-label="邀请备注" :disabled="isPending" />
      <p v-if="errorMessage" class="form-error" role="alert">{{ errorMessage }}</p>
      <div class="note-actions">
        <ElButton :disabled="isPending" @click="$emit('close')">取消</ElButton>
        <ElButton type="primary" native-type="submit" :loading="isPending">保存</ElButton>
      </div>
    </form>
  </ElDialog>
</template>

<style scoped>
.note-actions { display: flex; justify-content: flex-end; margin-top: 1rem; }
</style>
