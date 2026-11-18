<script setup lang="ts">
import { ElButton, ElInput } from 'element-plus'
import { reactive } from 'vue'
import type { AdminLogin } from '../api/admin-session'

defineProps<{ isPending: boolean; errorMessage: string }>()
const emit = defineEmits<{ submit: [credentials: AdminLogin] }>()

const form = reactive({ username: '', password: '' })

function submit(): void {
  emit('submit', { username: form.username.trim(), password: form.password })
  form.password = ''
}
</script>

<template>
  <form class="login-form" @submit.prevent="submit">
    <div class="login-form__field">
      <label for="admin-username">管理员账号</label>
      <ElInput
        id="admin-username"
        v-model="form.username"
        name="username"
        autocomplete="username"
        maxlength="48"
        required
        :disabled="isPending"
      />
    </div>
    <div class="login-form__field">
      <label for="admin-password">密码</label>
      <ElInput
        id="admin-password"
        v-model="form.password"
        type="password"
        name="password"
        autocomplete="current-password"
        maxlength="128"
        required
        :disabled="isPending"
      />
    </div>
    <p v-if="errorMessage" class="form-error" role="alert">{{ errorMessage }}</p>
    <ElButton class="login-form__submit" type="primary" native-type="submit" :loading="isPending">
      登录
    </ElButton>
  </form>
</template>

<style scoped>
.login-form {
  display: grid;
  gap: 1.25rem;
}

.login-form__field {
  display: grid;
  gap: 0.55rem;
  font-size: 0.875rem;
  font-weight: 600;
}

.login-form__field :deep(.el-input) {
  --el-input-height: 3rem;
  --el-input-border-radius: 0.4rem;
}

.login-form__submit {
  width: 100%;
  height: 3rem;
  margin-top: 0.25rem;
  font-weight: 700;
}
</style>
