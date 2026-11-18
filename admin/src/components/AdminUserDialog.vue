<script setup lang="ts">
import { ElButton, ElDialog, ElInput } from 'element-plus'
import { computed, reactive, shallowRef } from 'vue'

const props = defineProps<{
  mode: 'create' | 'reset' | 'enable' | 'disable'
  username?: string
  isPending: boolean
  errorMessage: string
}>()
const emit = defineEmits<{
  close: []
  confirm: [input: { username: string; password: string }]
}>()

const form = reactive({ username: '', password: '', confirmation: '' })
const validationMessage = shallowRef('')
const titles = { create: '新增账号', reset: '重置密码', enable: '启用账号', disable: '停用账号' }
const hasPassword = computed(() => props.mode === 'create' || props.mode === 'reset')

function submit(): void {
  validationMessage.value = ''
  if (hasPassword.value && form.password !== form.confirmation) {
    validationMessage.value = '两次输入的密码不一致。'
    return
  }
  emit('confirm', { username: form.username.trim(), password: form.password })
}
</script>

<template>
  <ElDialog
    :model-value="true"
    :title="titles[mode]"
    width="min(calc(100vw - 2rem), 29rem)"
    append-to-body
    :close-on-click-modal="false"
    :close-on-press-escape="!isPending"
    :show-close="!isPending"
    @close="emit('close')"
  >
    <form class="user-dialog__form" @submit.prevent="submit">
      <p v-if="mode === 'disable'">停用 {{ username }} 后，已有会话将立即失效。</p>
      <p v-if="mode === 'enable'">启用后，{{ username }} 可以重新登录。</p>
      <p v-if="mode === 'reset'">{{ username }} 的旧会话将失效，下次登录使用新密码。</p>
      <template v-if="mode === 'create'">
        <label for="managed-username">后台账号</label>
        <ElInput
          id="managed-username"
          v-model="form.username"
          required
          minlength="3"
          maxlength="48"
          autocomplete="off"
          :disabled="isPending"
        />
      </template>
      <template v-if="hasPassword">
        <label for="managed-password">登录密码</label>
        <ElInput
          id="managed-password"
          v-model="form.password"
          type="password"
          required
          minlength="12"
          maxlength="128"
          autocomplete="new-password"
          :disabled="isPending"
        />
        <label for="managed-confirm">确认密码</label>
        <ElInput
          id="managed-confirm"
          v-model="form.confirmation"
          type="password"
          required
          minlength="12"
          maxlength="128"
          autocomplete="new-password"
          :disabled="isPending"
        />
      </template>
      <p v-if="validationMessage || errorMessage" class="form-error" role="alert">
        {{ validationMessage || errorMessage }}
      </p>
      <div class="user-dialog__actions">
        <ElButton :disabled="isPending" @click="emit('close')">取消</ElButton>
        <ElButton
          :type="mode === 'disable' ? 'danger' : 'primary'"
          :loading="isPending"
          native-type="submit"
          >{{ titles[mode] }}</ElButton
        >
      </div>
    </form>
  </ElDialog>
</template>

<style scoped>
.user-dialog__form {
  display: grid;
  gap: 0.7rem;
}

.user-dialog__form p {
  margin: 0;
}

.user-dialog__form label {
  font-weight: 600;
}

.user-dialog__actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 0.5rem;
}
</style>
