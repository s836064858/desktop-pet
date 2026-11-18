<script setup lang="ts">
import { computed } from 'vue'
import { ElButton } from 'element-plus'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import AppIcon from '../../../src/components/common/AppIcon.vue'
import { DEFAULT_ADMIN_USERNAME } from '../api/admin-users'
import { useAdminAction } from '../composables/use-admin-action'
import { useAdminSessionStore } from '../stores/admin-session'
import BrandMark from './BrandMark.vue'

const router = useRouter()
const route = useRoute()
const sessionStore = useAdminSessionStore()
const { isPending, errorMessage, run } = useAdminAction()
const links = [
  { name: 'home', label: '后台首页', icon: 'sprout' },
  { name: 'usage', label: '任务与用量', icon: 'chart' },
  { name: 'invites', label: '邀请管理', icon: 'key' },
  { name: 'users', label: '用户管理', icon: 'smile' },
  { name: 'ai-settings', label: 'AI 设置', icon: 'sparkles' },
]
const isOwner = computed(() => sessionStore.session?.username === DEFAULT_ADMIN_USERNAME)
const visibleLinks = computed(() => links.filter((link) => link.name !== 'users' || isOwner.value))
const isSettingsHelp = computed(() => route.name === 'ai-settings-help')
const currentLabel = computed(() =>
  isSettingsHelp.value ? 'AI 设置帮助' : links.find((link) => link.name === route.name)?.label,
)

async function logout(): Promise<void> {
  const hasLoggedOut = await run(
    (signal) => sessionStore.logout(signal),
    () => '退出失败，请检查服务连接后重试。',
  )
  if (hasLoggedOut) await router.replace({ name: 'login' })
}
</script>

<template>
  <div v-if="sessionStore.session" class="admin-layout">
    <aside class="admin-layout__sidebar">
      <RouterLink class="admin-layout__brand" :to="{ name: 'home' }" aria-label="芽伴后台首页"><BrandMark /></RouterLink>
      <nav class="admin-layout__nav" aria-label="管理后台导航">
        <span class="admin-layout__nav-label">工作台</span>
        <RouterLink
          v-for="link in visibleLinks"
          :key="link.name"
          :to="{ name: link.name }"
          :class="{ 'is-section-active': isSettingsHelp && link.name === 'ai-settings' }"
        >
          <AppIcon :name="link.icon" :size="17" />{{ link.label }}
        </RouterLink>
      </nav>
    </aside>
    <div class="admin-layout__workspace">
      <header class="admin-layout__toolbar">
        <div class="admin-layout__location"><span>管理后台</span><span aria-hidden="true">/</span><strong>{{ currentLabel }}</strong></div>
        <div class="admin-layout__account">
          <span class="admin-layout__avatar" aria-hidden="true">{{ sessionStore.session.username[0]?.toUpperCase() }}</span>
          <span class="admin-layout__username" :title="sessionStore.session.username">{{ sessionStore.session.username }}</span>
          <span v-if="!isOwner" class="admin-layout__access">只读</span>
          <ElButton text :loading="isPending" @click="logout">退出登录</ElButton>
        </div>
      </header>
      <main class="admin-layout__content">
        <p v-if="errorMessage" class="form-error" role="alert">{{ errorMessage }}</p>
        <RouterView />
      </main>
    </div>
  </div>
</template>

<style scoped>
.admin-layout { display: grid; grid-template-columns: 13.25rem minmax(0, 1fr); min-height: 100dvh; }
.admin-layout__sidebar { padding: 1.2rem 0.85rem; background: #18332b; color: #f1f5f2; }
.admin-layout__brand { display: block; padding: 0.15rem 0.45rem 1.45rem; color: inherit; text-decoration: none; }
.admin-layout__nav { display: grid; gap: 0.3rem; }
.admin-layout__nav-label { padding: 0 0.75rem 0.4rem; color: #a4baae; font-size: 0.74rem; }
.admin-layout__nav a {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.68rem 0.75rem;
  border-radius: 6px;
  color: #dce7e0;
  font-size: 0.86rem;
  text-decoration: none;
  white-space: nowrap;
}
.admin-layout__nav a:hover { background: #254439; color: #fff; }
.admin-layout__nav .router-link-exact-active,
.admin-layout__nav .is-section-active { background: #325b49; color: #fff; box-shadow: inset 3px 0 #a3d0b3; }
.admin-layout__toolbar, .admin-layout__location, .admin-layout__account { display: flex; align-items: center; }
.admin-layout__toolbar { justify-content: space-between; gap: 0.5rem; min-height: 3.65rem; padding: 0.55rem 1.75rem; border-bottom: 1px solid var(--color-line); background: var(--color-surface); font-size: 0.83rem; }
.admin-layout__location { gap: 0.55rem; color: var(--color-muted); }
.admin-layout__location strong { color: var(--color-text); }
.admin-layout__account { min-width: 0; gap: 0.45rem; }
.admin-layout__avatar { display: grid; place-items: center; width: 1.65rem; height: 1.65rem; flex: none; border-radius: 50%; background: var(--color-selection); color: var(--el-color-primary); font-weight: 700; }
.admin-layout__username { max-width: 8rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.admin-layout__access { color: var(--color-muted); white-space: nowrap; }
.admin-layout__content { width: min(100%, 79rem); margin-inline: auto; padding: 1.75rem; }

@media (max-width: 780px) {
  .admin-layout { display: block; }
  .admin-layout__sidebar { padding: 0.65rem 0.75rem; }
  .admin-layout__brand { padding: 0 0.3rem 0.65rem; }
  .admin-layout__nav { display: flex; gap: 0.25rem; overflow-x: auto; scrollbar-width: thin; }
  .admin-layout__nav-label, .admin-layout__nav :deep(svg) { display: none; }
  .admin-layout__nav a { padding: 0.55rem 0.45rem; font-size: 0.78rem; }
  .admin-layout__content { padding: 1.25rem 0.9rem; }
  .admin-layout__toolbar { padding-inline: 0.9rem; }
}
@media (max-width: 430px) {
  .admin-layout__location > span { display: none; }
  .admin-layout__location { white-space: nowrap; }
  .admin-layout__username { max-width: 5.25rem; }
}
</style>
