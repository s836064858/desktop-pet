<script setup lang="ts">
import { ElButton } from 'element-plus'
import { computed, onMounted, shallowRef } from 'vue'
import { useRouter } from 'vue-router'
import { loadTosSettings, saveTosSettings, TosSettingsError } from '../api/tos-settings'
import type { TosSettings, TosSettingsInput } from '../api/tos-settings'
import TosSettingsForm from './TosSettingsForm.vue'
import { DEFAULT_ADMIN_USERNAME } from '../api/admin-users'
import { useAdminAction } from '../composables/use-admin-action'
import { useAdminSessionStore } from '../stores/admin-session'

const router = useRouter()
const sessionStore = useAdminSessionStore()
const canEdit = computed(() => sessionStore.session?.username === DEFAULT_ADMIN_USERNAME)
const { isPending, errorMessage, run } = useAdminAction()
const settings = shallowRef<TosSettings | null>(null)
const hasLoaded = shallowRef(false)
const hasSaved = shallowRef(false)
const formRevision = shallowRef(0)
const dateFormatter = new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' })
const updatedAt = computed(() =>
  settings.value ? dateFormatter.format(new Date(settings.value.updatedAt)) : '',
)

function describeError(error: unknown): string {
  if (error instanceof TosSettingsError) {
    if (error.status === 401) {
      sessionStore.clear()
      void router.replace({ name: 'login', query: { reason: 'expired' } })
    }
    return error.message
  }
  return 'TOS 配置请求失败，请检查网络后重试。'
}

async function load(): Promise<void> {
  hasSaved.value = false
  await run(async (signal) => {
    const current = await loadTosSettings(signal)
    signal.throwIfAborted()
    settings.value = current
    formRevision.value += 1
    hasLoaded.value = true
  }, describeError)
}

async function save(input: TosSettingsInput): Promise<void> {
  hasSaved.value = false
  await run(async (signal) => {
    const current = await saveTosSettings(input, signal)
    signal.throwIfAborted()
    settings.value = current
    formRevision.value += 1
    hasSaved.value = true
  }, describeError)
}

onMounted(load)
</script>

<template>
    <section class="ops-panel" aria-labelledby="tos-heading">
      <div class="ops-heading">
        <h2 id="tos-heading">TOS 素材存储</h2>
        <span
          v-if="hasLoaded"
          class="ai-settings__status"
          :class="{ 'is-configured': settings !== null }"
        >
          {{ settings ? '已配置' : '待配置' }}
        </span>
      </div>
      <p v-if="canEdit" class="ops-detail">验证会上传一张测试图，下载核对后删除测试对象。</p>
      <p v-if="updatedAt" class="ai-settings__detail ai-settings__detail--update">
        上次更新 {{ updatedAt }}
      </p>
      <div v-if="errorMessage" class="ai-settings__feedback">
        <p class="form-error" role="alert">{{ errorMessage }}</p>
        <ElButton size="small" :disabled="isPending" @click="load">重新加载</ElButton>
      </div>
      <p v-if="hasSaved" class="ops-success" role="status">TOS 上传、下载与清理验证通过，配置已保存。</p>
      <TosSettingsForm
        v-if="hasLoaded && canEdit"
        :key="formRevision"
        :settings="settings"
        :is-pending="isPending"
        @save="save"
      />
      <p v-else-if="hasLoaded && settings">{{ settings.bucket }} / {{ settings.region }}</p>
      <p v-else-if="isPending" class="ai-settings__detail" role="status">正在加载配置…</p>
    </section>
</template>

<style scoped>
.ai-settings__status {
  padding: 0.2rem 0.62rem;
  border-radius: 1rem;
  background: #f2ebd8;
  color: #765c2c;
  font-size: 0.75rem;
  font-weight: 600;
}

.ai-settings__status.is-configured {
  background: var(--color-selection);
  color: var(--el-color-primary-dark-2);
}

.ai-settings__detail,
.ai-settings__feedback {
  margin: 0.55rem 0 1.35rem;
  color: var(--color-muted);
  font-size: 0.875rem;
}

.ai-settings__detail--update { font-size: 0.8rem; }

.ai-settings__feedback {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.6rem 1rem;
}

</style>
