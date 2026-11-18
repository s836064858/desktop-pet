<script setup lang="ts">
import { ElButton, ElInput } from 'element-plus'
import { reactive } from 'vue'
import type { TosSettings, TosSettingsInput } from '../api/tos-settings'

const props = defineProps<{ settings: TosSettings | null; isPending: boolean }>()
const emit = defineEmits<{ save: [input: TosSettingsInput] }>()
const form = reactive({
  bucket: props.settings?.bucket ?? '',
  region: props.settings?.region ?? '',
  accessKeyId: '',
  accessKeySecret: '',
})

function submit(): void {
  emit('save', { ...form, version: props.settings?.version ?? 0 })
}
</script>

<template>
  <form class="tos-form" @submit.prevent="submit">
    <div class="tos-form__field">
      <label for="tos-bucket">存储桶名称</label>
      <ElInput
        id="tos-bucket"
        v-model="form.bucket"
        required
        maxlength="63"
        :disabled="isPending"
      />
    </div>
    <div class="tos-form__field">
      <label for="tos-region">地域 ID</label>
      <ElInput
        id="tos-region"
        v-model="form.region"
        placeholder="例如 cn-beijing"
        required
        maxlength="32"
        :disabled="isPending"
      />
    </div>
    <div class="tos-form__field">
      <label for="tos-access-key">AccessKey ID</label>
      <ElInput
        id="tos-access-key"
        v-model="form.accessKeyId"
        :placeholder="settings ? '当前 …' + settings.accessKeyHint : undefined"
        autocomplete="off"
        required
        maxlength="128"
        :disabled="isPending"
      />
    </div>
    <div class="tos-form__field">
      <label for="tos-secret-key">AccessKey Secret</label>
      <ElInput
        id="tos-secret-key"
        v-model="form.accessKeySecret"
        type="password"
        autocomplete="new-password"
        required
        maxlength="256"
        :disabled="isPending"
      />
    </div>
    <div class="tos-form__actions">
      <ElButton type="primary" native-type="submit" :loading="isPending">
        {{ isPending ? '正在验证…' : '验证并保存' }}
      </ElButton>
      <span v-if="settings">更新时请重新输入访问凭证。</span>
    </div>
  </form>
</template>

<style scoped>
.tos-form {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1.15rem 1.4rem;
}

.tos-form__field {
  display: grid;
  gap: 0.48rem;
  font-size: 0.875rem;
  font-weight: 600;
}

.tos-form__field :deep(.el-input) {
  --el-input-height: 2.65rem;
  --el-input-border-radius: 0.4rem;
}

.tos-form__actions {
  display: flex;
  grid-column: 1 / -1;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.65rem 1rem;
  margin-top: 0.3rem;
}

.tos-form__actions span {
  color: var(--color-muted);
  font-size: 0.8rem;
}

@media (max-width: 550px) {
  .tos-form {
    grid-template-columns: 1fr;
  }
}
</style>
