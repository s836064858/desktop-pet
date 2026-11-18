<script setup lang="ts">
import { shallowRef } from 'vue'

defineProps<{ isBusy: boolean; errorMessage: string }>()
const emit = defineEmits<{ activate: [input: { code: string; name: string }]; reload: []; forget: [] }>()
const code = shallowRef('')
const name = shallowRef('')

function submit(): void {
  emit('activate', { code: code.value.trim(), name: name.value.trim() })
}
</script>

<template>
  <form class="forge-activation" @submit.prevent="submit">
    <h3>激活 AI 创建</h3>
    <label>昵称<el-input v-model="name" maxlength="48" required :disabled="isBusy" /></label>
    <label>邀请码<el-input v-model="code" maxlength="32" required autocomplete="off" :disabled="isBusy" /></label>
    <p v-if="errorMessage" class="inline-note error-note" role="alert">{{ errorMessage }}</p>
    <div>
      <el-button :disabled="isBusy" @click="emit('reload')">重新连接</el-button>
      <el-button type="primary" native-type="submit" :loading="isBusy" :disabled="!name.trim() || !code.trim()">激活</el-button>
    </div>
    <el-popconfirm title="清除本机凭证？重新激活需要邀请码。" @confirm="emit('forget')">
      <template #reference><el-button text :disabled="isBusy">清除本机凭证</el-button></template>
    </el-popconfirm>
  </form>
</template>

<style scoped>
.forge-activation { display: grid; gap: 16px; width: min(100%, 360px); margin: auto; padding: 24px 0; }
.forge-activation label { display: grid; gap: 6px; }
</style>
