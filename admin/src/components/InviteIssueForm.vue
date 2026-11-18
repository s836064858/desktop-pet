<script setup lang="ts">
import { ElButton, ElInputNumber, ElOption, ElSelect } from 'element-plus'
import { computed, shallowRef } from 'vue'
import type { IssueInvitesInput } from '../api/ai-admin'
import AppIcon from '../../../src/components/common/AppIcon.vue'

const props = defineProps<{ isPending: boolean; replacement: { userId: string; nickname: string | null } | null }>()
const emit = defineEmits<{ issue: [input: IssueInvitesInput]; clear: [] }>()
const days = shallowRef(7)
const count = shallowRef<number | undefined>(1)
const issueCount = computed(() => props.replacement ? 1 : count.value)
const hasValidCount = computed(() => isValidCount(issueCount.value))

function isValidCount(value: number | undefined): value is number {
  return value !== undefined && Number.isInteger(value) && value >= 1 && value <= 50
}

function submit(): void {
  const quantity = issueCount.value
  if (props.isPending || !isValidCount(quantity)) return
  emit('issue', { count: quantity, days: days.value, userId: props.replacement?.userId })
}
</script>

<template>
  <form @submit.prevent="submit">
    <p v-if="replacement" class="replacement-target">
      <AppIcon name="key" :size="15" />换机用户：<strong>{{ replacement.nickname || '未填写昵称' }}</strong>
    </p>
    <div class="ops-controls invite-controls">
      <label v-if="!replacement" class="invite-field">
        <span>生成数量</span>
        <ElInputNumber
          v-model="count"
          class="invite-count"
          aria-label="生成数量"
          controls-position="right"
          :min="1"
          :max="50"
          :disabled="isPending"
        />
      </label>
      <label class="invite-field">
        <span>兑换有效期</span>
        <ElSelect v-model="days" aria-label="兑换有效期" class="ops-select" :disabled="isPending">
          <ElOption v-for="day in [1, 7, 14, 30]" :key="day" :value="day" :label="`${day} 天`" />
        </ElSelect>
      </label>
      <ElButton native-type="submit" type="primary" :loading="isPending" :disabled="!hasValidCount">
        <AppIcon v-if="!isPending" name="key" :size="15" />{{ replacement ? '生成换机邀请码' : '生成邀请码' }}
      </ElButton>
      <ElButton v-if="replacement" :disabled="isPending" @click="emit('clear')">取消换机</ElButton>
    </div>
  </form>
</template>

<style scoped>
.invite-controls { align-items: flex-end; }
.invite-field { display: grid; gap: 0.35rem; font-size: 0.85rem; }
.invite-count { width: 6.5rem; }
.replacement-target { color: var(--color-muted); }
.replacement-target { display: flex; align-items: center; gap: 0.35rem; margin: 0 0 0.75rem; font-size: 0.85rem; }
.replacement-target strong { min-width: 0; overflow-wrap: anywhere; }
</style>
