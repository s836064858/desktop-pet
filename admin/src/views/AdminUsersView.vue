<script setup lang="ts">
import { ElButton } from 'element-plus'
import { onMounted, shallowRef } from 'vue'
import { useRouter } from 'vue-router'
import {
  AdminUsersError,
  createAdminUser,
  listAdminUsers,
  resetAdminPassword,
  setAdminEnabled,
} from '../api/admin-users'
import type { AdminUser } from '../api/admin-users'
import AdminUserDialog from '../components/AdminUserDialog.vue'
import AdminUsersTable from '../components/AdminUsersTable.vue'
import AdminPageHeader from '../components/AdminPageHeader.vue'
import { useAdminAction } from '../composables/use-admin-action'
import { useAdminSessionStore } from '../stores/admin-session'

type UserAction = { mode: 'create' } | { mode: 'enable' | 'disable' | 'reset'; user: AdminUser }

const sessionStore = useAdminSessionStore()
const router = useRouter()
const loader = useAdminAction()
const mutation = useAdminAction()
const users = shallowRef<AdminUser[] | null>(null)
const action = shallowRef<UserAction | null>(null)

function describeError(error: unknown): string {
  if (error instanceof AdminUsersError) {
    if (error.status === 401) {
      sessionStore.clear()
      void router.replace({ name: 'login', query: { reason: 'expired' } })
    }
    return error.message
  }
  return '暂时无法访问后台账号，请检查连接后重试。'
}

async function load(): Promise<void> {
  await loader.run(async (signal) => {
    const next = await listAdminUsers(signal)
    signal.throwIfAborted()
    users.value = next
  }, describeError)
}

function open(next: UserAction): void {
  mutation.clearError()
  action.value = next
}

async function persist(
  current: UserAction,
  input: { username: string; password: string },
  signal: AbortSignal,
): Promise<void> {
  if (current.mode === 'create') return createAdminUser(input, signal)
  if (current.mode === 'reset') return resetAdminPassword(current.user.id, input.password, signal)
  return setAdminEnabled(current.user.id, current.mode === 'enable', signal)
}

async function confirm(input: { username: string; password: string }): Promise<void> {
  const current = action.value
  if (!current) return
  const saved = await mutation.run((signal) => persist(current, input, signal), describeError)
  if (saved) {
    action.value = null
    await load()
  }
}

onMounted(load)
</script>

<template>
  <section class="users-view">
    <AdminPageHeader title="用户管理" section="访问管理">
      <template #actions>
        <ElButton type="primary" :disabled="loader.isPending.value" @click="open({ mode: 'create' })">新增账号</ElButton>
      </template>
    </AdminPageHeader>
    <p v-if="loader.isPending.value && users === null" role="status">正在加载后台账号…</p>
    <div v-if="loader.errorMessage.value" class="users-view__feedback">
      <p class="form-error" role="alert">{{ loader.errorMessage.value }}</p>
      <ElButton size="small" @click="load">重试</ElButton>
    </div>
    <AdminUsersTable
      v-if="users?.length"
      :users="users"
      :is-pending="loader.isPending.value || mutation.isPending.value"
      @reset-password="(user) => open({ mode: 'reset', user })"
      @toggle-status="(user) => open({ mode: user.isEnabled ? 'disable' : 'enable', user })"
    />
    <p v-else-if="users" class="users-view__feedback">暂无后台账号。</p>
    <AdminUserDialog
      v-if="action"
      :mode="action.mode"
      :username="action.mode === 'create' ? undefined : action.user.username"
      :is-pending="mutation.isPending.value"
      :error-message="mutation.errorMessage.value"
      @confirm="confirm"
      @close="action = null"
    />
  </section>
</template>

<style scoped>
.users-view__feedback {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.8rem;
  margin-bottom: 1.35rem;
}

</style>
