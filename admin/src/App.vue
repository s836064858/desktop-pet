<script setup lang="ts">
import { watch } from 'vue'
import { RouterView, useRouter } from 'vue-router'
import { useAdminSessionStore } from './stores/admin-session'

const router = useRouter()
const sessionStore = useAdminSessionStore()

watch(
  () => sessionStore.session?.expiresAt,
  (expiresAt, _, onCleanup) => {
    if (!expiresAt) return
    const timer = window.setTimeout(
      () => {
        sessionStore.clear()
        void router.replace({ name: 'login', query: { reason: 'expired' } })
      },
      Math.max(0, Date.parse(expiresAt) - Date.now()),
    )
    onCleanup(() => window.clearTimeout(timer))
  },
  { immediate: true },
)
</script>

<template>
  <RouterView v-slot="{ Component }">
    <component :is="Component" v-if="Component" />
    <p v-else class="session-loading" role="status">正在检查登录状态…</p>
  </RouterView>
</template>
