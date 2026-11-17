<script setup lang="ts">
import { computed, onMounted, onUnmounted, shallowRef } from 'vue'
import { ElMessage } from 'element-plus'
import { readSettings, saveSettings } from '../../../lib/capabilities'
import AppIcon from '../../common/AppIcon.vue'
import ForgeGuide from './ForgeGuide.vue'

const props = defineProps<{ isDisabled: boolean }>()
const isOpen = defineModel<boolean>('isOpen', { default: false })
const isGuideOpen = defineModel<boolean>('isGuideOpen', { default: false })
const emit = defineEmits<{
  status: [state: { hasKey: boolean; isBusy: boolean; hasReadError: boolean }]
}>()
const keyInput = shallowRef('')
const hasKey = shallowRef(false)
const hasReadError = shallowRef(false)
const isLoading = shallowRef(false)
const isSaving = shallowRef(false)
const errorMessage = shallowRef('')
const keyStatus = computed(() =>
  isLoading.value
    ? '读取密钥…'
    : hasReadError.value
      ? '密钥读取失败'
      : hasKey.value
        ? '密钥已配置'
        : '配置密钥',
)
let isActive = true

function publishStatus(): void {
  emit('status', {
    hasKey: hasKey.value,
    isBusy: isLoading.value || isSaving.value,
    hasReadError: hasReadError.value,
  })
}

async function loadKey(): Promise<void> {
  if (props.isDisabled || isLoading.value || isSaving.value) return
  isLoading.value = true
  hasReadError.value = false
  errorMessage.value = ''
  publishStatus()
  try {
    const settings = await readSettings()
    if (!isActive) return
    keyInput.value = settings.arkApiKey
    hasKey.value = Boolean(settings.arkApiKey.trim())
  } catch {
    if (isActive) {
      hasReadError.value = true
      errorMessage.value = '密钥读取失败，请重试。'
    }
  } finally {
    if (isActive) {
      isLoading.value = false
      publishStatus()
    }
  }
}

async function saveKey(): Promise<void> {
  if (props.isDisabled || isSaving.value || isLoading.value) return
  const key = keyInput.value.trim()
  if (!key) {
    errorMessage.value = '请输入火山方舟 API Key。'
    return
  }
  isSaving.value = true
  errorMessage.value = ''
  publishStatus()
  try {
    await saveSettings({ arkApiKey: key })
    if (!isActive) return
    hasKey.value = true
    hasReadError.value = false
    isOpen.value = false
    ElMessage.success('密钥已保存。')
  } catch {
    if (isActive) errorMessage.value = '密钥保存失败，请重试。'
  } finally {
    finishSaving()
  }
}

function finishSaving(): void {
  if (!isActive) return
  isSaving.value = false
  publishStatus()
}
function onVisibilityChange(value: boolean): void {
  if (!props.isDisabled && !isSaving.value && !isLoading.value) isOpen.value = value
}
function openGuide(): void {
  isOpen.value = false
  isGuideOpen.value = true
}
function finishGuide(): void {
  isGuideOpen.value = false
  isOpen.value = true
}
onMounted(() => {
  void loadKey()
})
onUnmounted(() => {
  isActive = false
  keyInput.value = ''
})
</script>

<template>
  <div class="forge-key-control">
    <el-popover
      role="dialog"
      :visible="isOpen"
      trigger="click"
      placement="bottom-end"
      width="min(360px, calc(100vw - 70px))"
      :persistent="false"
      popper-class="forge-key-popover"
      @update:visible="onVisibilityChange"
    >
      <template #reference>
        <el-button
          class="key-toggle"
          text
          size="small"
          :disabled="isDisabled || isLoading || isSaving"
          :aria-expanded="isOpen"
          aria-label="配置或修改 AI 素材密钥"
          ><AppIcon name="key" :size="14" />{{ keyStatus
          }}<AppIcon name="chevron-down" :size="12"
        /></el-button>
      </template>
      <section class="key-editor" aria-label="AI 素材密钥设置">
        <h3 class="key-title">AI 素材密钥</h3>
        <p class="key-description">
          使用火山方舟 API Key，用于植物识别、对话规划和生图。
        </p>
        <form class="key-form" @submit.prevent="saveKey">
          <el-input
            v-model="keyInput"
            aria-label="火山方舟 API Key"
            placeholder="输入 ARK_API_KEY"
            type="password"
            show-password
            autocomplete="off"
            :disabled="isDisabled || isLoading || isSaving"
          />
          <el-button
            :loading="isSaving"
            :disabled="isDisabled || isLoading"
            native-type="submit"
            >保存密钥</el-button
          >
        </form>
        <p v-if="errorMessage" class="key-feedback" role="alert">
          {{ errorMessage
          }}<el-button
            v-if="hasReadError"
            text
            size="small"
            :disabled="isLoading || isSaving || isDisabled"
            @click="loadKey"
            >重新读取</el-button
          >
        </p>
        <el-button
          class="key-guide-link"
          text
          size="small"
          :disabled="isDisabled || isLoading || isSaving"
          @click="openGuide"
          >查看获取教程<AppIcon name="arrow-right" :size="13"
        /></el-button>
      </section>
    </el-popover>
    <el-dialog
      v-model="isGuideOpen"
      title="获取 AI 素材密钥"
      class="forge-key-guide"
      width="min(600px, calc(100vw - 60px))"
      align-center
      append-to-body
      :close-on-click-modal="false"
    >
      <ForgeGuide @done="finishGuide" />
    </el-dialog>
  </div>
</template>

<style scoped>
.forge-key-control {
  flex-shrink: 0;
}
.key-toggle {
  color: #7a8f68;
  font-size: 10px;
  padding: 4px 0 4px 8px;
}
.key-toggle :deep(span) {
  gap: 6px;
}
.key-title {
  margin: 0 0 8px;
  font-size: 14px;
  font-weight: 600;
  color: #456746;
}
.key-description {
  margin: 0 0 12px;
  font-size: 11px;
  line-height: 1.8;
  color: #8a927e;
}
.key-form {
  display: flex;
  align-items: center;
  gap: 8px;
}
.key-form :deep(.el-input) {
  min-width: 0;
}
.key-guide-link {
  margin-top: 10px;
  padding: 0;
  font-size: 11px;
  color: #668058;
}
.key-guide-link :deep(span) {
  gap: 6px;
}
.key-feedback {
  margin: 8px 0 0;
  font-size: 11px;
  line-height: 1.8;
  color: #ad573e;
}
.key-feedback :deep(.el-button) {
  font-size: 11px;
  padding: 0 4px;
}
</style>

<style>
.forge-key-popover.el-popover {
  padding: 16px;
  border: 1px solid #dfe4d4;
  border-radius: 10px;
  background: #fffef9;
}
.forge-key-guide {
  max-height: calc(100vh - 60px);
  display: flex;
  flex-direction: column;
}
.forge-key-guide .el-dialog__body {
  min-height: 0;
  overflow-y: auto;
}
</style>
