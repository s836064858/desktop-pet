<script setup lang="ts">
import { ElButton, ElInput, ElPopconfirm, ElTag } from 'element-plus'
import { onMounted, shallowRef } from 'vue'
import { aiAdmin } from '../api/ai-admin'
import type { AiConfig } from '../api/ai-admin'
import { useAiAdminAction } from '../composables/use-ai-admin-action'

const { isPending, errorMessage, canEdit, run } = useAiAdminAction()
const state = shallowRef<AiConfig | null>(null)
const key = shallowRef('')
const notice = shallowRef('')
const pendingKind = shallowRef<'ark' | 'pause' | null>(null)

function load() {
  return run(async (signal) => {
    const result = await aiAdmin<AiConfig>('/config', signal)
    signal.throwIfAborted()
    state.value = result
  })
}

async function write(kind: 'ark' | 'pause'): Promise<void> {
  const current = state.value
  if (!current || !canEdit.value || isPending.value || (kind === 'ark' && !key.value.trim())) return
  notice.value = ''
  pendingKind.value = kind
  try {
    await run(async (signal) => {
      const body = kind === 'ark' ? { key: key.value.trim() } : { isPaused: !current.isPaused }
      const result = await aiAdmin<AiConfig>(`/config/${kind}`, signal, 'PUT', { ...body, version: current.version })
      signal.throwIfAborted()
      state.value = result
      if (kind === 'ark') key.value = ''
      notice.value = kind === 'ark' ? '方舟对话验证通过，配置已保存。' : result.isPaused ? 'AI 已暂停。' : 'AI 已恢复。'
    })
  } finally {
    pendingKind.value = null
  }
}

onMounted(load)
</script>

<template>
  <section class="ops-panel">
    <div class="ops-heading"><h2>AI 运行状态</h2><ElTag v-if="state" disable-transitions size="small" :type="state.isPaused ? 'warning' : 'success'">{{ state.isPaused ? '已暂停' : '允许派发' }}</ElTag></div>
    <template v-if="state">
      <div v-if="canEdit" class="service-control">
        <ElPopconfirm :title="state.isPaused ? '恢复 AI 任务派发？' : '暂停新 AI 操作和排队派发？'" @confirm="write('pause')">
          <template #reference><ElButton :loading="pendingKind === 'pause'" :disabled="isPending">{{ state.isPaused ? '恢复 AI' : '暂停 AI' }}</ElButton></template>
        </ElPopconfirm>
      </div>
      <div class="ops-heading service-ark">
        <h2>火山方舟</h2><ElTag disable-transitions size="small" :type="state.hasArkKey ? 'success' : 'info'">{{ state.hasArkKey ? '已配置' : '未配置' }}</ElTag>
      </div>
      <form v-if="canEdit" class="service-form" @submit.prevent="write('ark')">
        <label for="ark-key">方舟 API Key</label>
        <div class="ops-controls">
          <ElInput id="ark-key" v-model="key" type="password" autocomplete="new-password" maxlength="256" :placeholder="state.hasArkKey ? '输入新 Key 以替换' : '输入方舟 API Key'" :disabled="isPending" />
          <ElButton type="primary" native-type="submit" :loading="pendingKind === 'ark'" :disabled="isPending || !key.trim()">验证并保存</ElButton>
        </div>
        <p class="ops-detail">验证会实际调用一次对话模型，可能产生少量 Token 费用；不会触发生图。</p>
      </form>
    </template>
    <p v-else-if="isPending" class="ops-detail" role="status">正在读取方舟配置…</p>
    <p v-if="errorMessage" class="form-error" role="alert">{{ errorMessage }} <ElButton text :disabled="isPending" @click="load">重新加载</ElButton></p>
    <p v-if="notice" class="ops-success" role="status">{{ notice }}</p>
  </section>
</template>

<style scoped>
.service-ark { margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--color-line); }
.service-form label { display: block; margin-bottom: 0.45rem; font-size: 0.875rem; font-weight: 600; }
.service-form p { margin-bottom: 0; }
</style>
