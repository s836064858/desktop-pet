<script setup lang="ts">
import { ElButton } from 'element-plus'
import type { AdminUser } from '../api/admin-users'

defineProps<{ users: AdminUser[]; isPending: boolean }>()
const emit = defineEmits<{ resetPassword: [user: AdminUser]; toggleStatus: [user: AdminUser] }>()
</script>

<template>
  <div class="users-table" tabindex="0" aria-label="后台账号列表">
    <table>
      <thead>
        <tr>
          <th scope="col">账号</th>
          <th scope="col">类型</th>
          <th scope="col">状态</th>
          <th scope="col">操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="user in users" :key="user.id">
          <td class="users-table__name">{{ user.username }}</td>
          <td>{{ user.isDefault ? '默认管理员' : '只读账号' }}</td>
          <td>
            <span
              class="users-table__status"
              :class="{ 'is-enabled': user.isEnabled }"
            >
              {{ user.isEnabled ? '已启用' : '已停用' }}
            </span>
          </td>
          <td>
            <span v-if="user.isDefault" class="users-table__protected">受保护</span>
            <template v-else>
              <ElButton link :disabled="isPending" @click="emit('resetPassword', user)"
                >重置密码</ElButton
              >
              <ElButton
                :type="user.isEnabled ? 'danger' : 'primary'"
                link
                :disabled="isPending"
                @click="emit('toggleStatus', user)"
              >
                {{ user.isEnabled ? '停用' : '启用' }}
              </ElButton>
            </template>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.users-table {
  overflow-x: auto;
  border: 1px solid var(--color-line);
  border-radius: 8px;
  background: var(--color-surface);
}

.users-table table {
  width: 100%;
  min-width: 34rem;
  border-collapse: collapse;
  text-align: left;
  font-size: 0.9rem;
}

.users-table th,
.users-table td {
  padding: 0.85rem 1rem;
  border-bottom: 1px solid var(--color-line);
}

.users-table th {
  background: var(--color-subtle);
  font-weight: 600;
}

.users-table tr:last-child td {
  border-bottom: 0;
}

.users-table__name {
  max-width: 14rem;
  font-weight: 650;
  overflow-wrap: anywhere;
}

.users-table__status {
  display: inline-block;
  padding: 0.14rem 0.55rem;
  border-radius: 1rem;
  background: #f2ebd8;
  color: #765c2c;
  white-space: nowrap;
  font-size: 0.75rem;
}

.users-table__status.is-enabled {
  background: var(--color-selection);
  color: var(--el-color-primary-dark-2);
}

.users-table__protected {
  color: var(--color-muted);
}
</style>
