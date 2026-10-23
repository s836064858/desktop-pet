<script setup lang="ts">
import { onMounted, onUnmounted, shallowRef } from 'vue'
import { readSettings, saveSettings } from '../../../lib/capabilities'
import AppIcon from '../../common/AppIcon.vue'

const props = defineProps<{ isDisabled: boolean }>()
const emit = defineEmits<{ status: [state: { hasKey: boolean; isBusy: boolean }] }>()
const keyInput = shallowRef('')
const hasKey = shallowRef(false)
const isExpanded = shallowRef(false)
const isLoading = shallowRef(true)
const isSaving = shallowRef(false)
const errorMessage = shallowRef('')
const successMessage = shallowRef('')
let isActive = true

function publishStatus(): void {
  emit('status', { hasKey: hasKey.value, isBusy: isLoading.value || isSaving.value })
}

async function loadKey(): Promise<void> {
  isLoading.value = true
  errorMessage.value = ''
  publishStatus()
  try {
    const settings = await readSettings()
    if (!isActive) return
    keyInput.value = settings.arkApiKey
    hasKey.value = Boolean(settings.arkApiKey.trim())
    isExpanded.value = !hasKey.value
  } catch {
    if (isActive) {
      errorMessage.value = '密钥读取失败，请重试。'
      isExpanded.value = true
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
  successMessage.value = ''
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
    onKeySaved()
  } catch {
    if (isActive) errorMessage.value = '密钥保存失败，请重试。'
  } finally {
    finishSaving()
  }
}

function onKeySaved(): void {
  hasKey.value = true
  isExpanded.value = false
  successMessage.value = '密钥已保存，可以开始起草了。'
}

function finishSaving(): void {
  if (!isActive) return
  isSaving.value = false
  publishStatus()
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
  <section class="api-key" aria-label="AI 素材密钥">
    <div class="key-summary">
      <div class="key-label">
        <AppIcon name="key" :size="17" /><span>AI 素材密钥</span
        ><span class="key-status">{{ isLoading ? '读取中…' : hasKey ? '已配置' : '未配置' }}</span>
      </div>
      <el-button
        size="small"
        text
        :disabled="isDisabled || isLoading || isSaving"
        :aria-expanded="isExpanded"
        @click="isExpanded = !isExpanded"
        >{{ isExpanded ? '收起' : hasKey ? '修改密钥' : '配置密钥' }}</el-button
      >
    </div>
    <div v-if="isExpanded" class="key-content">
      <p class="muted">使用火山方舟 API Key，保存后仅用于本机 AI 生成。</p>
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
        <el-button :loading="isSaving" :disabled="isDisabled || isLoading" native-type="submit"
          >保存密钥</el-button
        >
      </form>
      <p class="muted key-help">密钥获取：火山方舟控制台 · console.volcengine.com/ark</p>
    </div>
    <p v-if="errorMessage" class="key-feedback" role="alert">
      {{ errorMessage }}
      <el-button
        v-if="!hasKey"
        text
        size="small"
        :disabled="isLoading || isSaving || isDisabled"
        @click="loadKey"
        >重新读取</el-button
      >
    </p>
    <p v-else-if="successMessage" class="key-success" role="status">{{ successMessage }}</p>
  </section>
</template>
<style scoped>
.api-key {
  padding: 8px 13px;
  border: 1px solid #dfe4d4;
  border-radius: 9px;
  background: #f1f4e9;
  margin-bottom: 20px;
}
.key-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.key-label {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #526e4f;
  font-size: 12px;
}
.key-status {
  color: #8b957d;
  font-size: 10px;
}
.key-form {
  display: flex;
  gap: 8px;
}
.key-content .muted {
  margin: 5px 0 10px;
  font-size: 11px;
}
.key-content .key-help {
  margin: 8px 0 3px;
  color: #8a927e;
}
.key-feedback {
  margin: 6px 0 0;
  font-size: 11px;
  color: #ad573e;
}
.key-success {
  margin: 4px 0 2px;
  font-size: 11px;
  color: #528048;
}
</style>
