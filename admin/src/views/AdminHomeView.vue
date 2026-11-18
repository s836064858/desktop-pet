<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import AppIcon from '../../../src/components/common/AppIcon.vue'
import AdminPageHeader from '../components/AdminPageHeader.vue'
import { useAdminSessionStore } from '../stores/admin-session'

const sessionStore = useAdminSessionStore()
const dateFormat = new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' })
const expiryLabel = computed(() => {
  const expiry = sessionStore.session?.expiresAt
  return expiry ? dateFormat.format(new Date(expiry)) : ''
})
const shortcuts = [
  { name: 'usage', label: '查看调用明细', icon: 'chart' },
  { name: 'invites', label: '查看邀请码', icon: 'key' },
  { name: 'ai-settings', label: '查看服务配置', icon: 'sparkles' },
]
</script>

<template>
  <section v-if="sessionStore.session" class="admin-home">
    <AdminPageHeader title="后台首页" section="工作台" />
    <section class="ops-panel admin-home__shortcuts" aria-labelledby="shortcut-title">
      <div class="ops-heading"><h2 id="shortcut-title">常用入口</h2></div>
      <RouterLink v-for="shortcut in shortcuts" :key="shortcut.name" :to="{ name: shortcut.name }">
        <AppIcon :name="shortcut.icon" :size="18" /><span>{{ shortcut.label }}</span><AppIcon name="arrow-right" :size="16" />
      </RouterLink>
    </section>
    <section class="ops-panel" aria-labelledby="session-title">
      <div class="ops-heading"><h2 id="session-title">当前会话</h2></div>
      <dl class="admin-home__session">
        <dt>登录账号</dt><dd>{{ sessionStore.session.username }}</dd>
        <dt>会话到期</dt><dd>{{ expiryLabel }}</dd>
      </dl>
    </section>
  </section>
</template>

<style scoped>
.admin-home__shortcuts a {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 0.7rem;
  padding: 0.8rem 0.2rem;
  border-top: 1px solid var(--color-line);
  color: var(--color-text);
  text-decoration: none;
  font-size: 0.9rem;
}
.admin-home__shortcuts a:hover { color: var(--el-color-primary); background: var(--color-subtle); }

.admin-home__session {
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  gap: 0.7rem 1.25rem;
  margin: 0;
  font-size: 0.875rem;
}

.admin-home__session dt {
  color: var(--color-muted);
}

.admin-home__session dd {
  margin: 0;
  overflow-wrap: anywhere;
}
</style>
