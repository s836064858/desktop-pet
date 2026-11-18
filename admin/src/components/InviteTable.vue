<script setup lang="ts">
import { ElButton, ElMessage, ElPopconfirm, ElTable, ElTableColumn, ElTag } from 'element-plus'
import { computed } from 'vue'
import type { Invite } from '../api/ai-admin'
import { useAdminAction } from '../composables/use-admin-action'
import { formatInviteDate } from '../lib/format-invite-date'

const props = defineProps<{ rows: Invite[]; batchIds: string[]; canEdit: boolean; isPending: boolean }>()
const emit = defineEmits<{
  revoke: [id: string]
  replace: [invite: Invite]
  editNote: [invite: Invite]
  setUserStatus: [input: { userId: string; isAiDisabled: boolean }]
}>()
const { isPending: isCopying, errorMessage: copyError, run: runCopy } = useAdminAction()
const batchCodes = computed(() => {
  const ids = new Set(props.batchIds)
  return props.rows.flatMap(({ id, code }) => code && ids.has(id) ? [code] : [])
})

function copyCodes(codes: string[]) {
  return runCopy(async (signal) => {
    await navigator.clipboard.writeText(codes.join('\n'))
    signal.throwIfAborted()
    ElMessage.success(`已复制 ${codes.length} 个邀请码`)
  }, () => '无法访问剪贴板，请选中邀请码手动复制。')
}

function state(invite: Invite) {
  if (invite.revokedAt) return '已撤销'
  if (invite.redeemedAt) return '已使用'
  return Date.parse(invite.expiresAt) <= Date.now() ? '已过期' : '待使用'
}

function toggleUserAi(invite: Invite): void {
  if (!invite.userId || invite.userRevokedAt || invite.isAiDisabled === null) return
  emit('setUserStatus', { userId: invite.userId, isAiDisabled: !invite.isAiDisabled })
}
</script>

<template>
  <div class="ops-heading">
    <h2>邀请码记录</h2>
    <small>{{ rows.length }} 条</small>
    <ElButton v-if="canEdit && batchCodes.length > 1" size="small" :disabled="isCopying" @click="copyCodes(batchCodes)">
      复制本批
    </ElButton>
  </div>
  <p v-if="copyError" class="form-error copy-error" role="alert">{{ copyError }}</p>
  <ElTable :data="rows" row-key="id" empty-text="还没有邀请码">
    <ElTableColumn label="邀请码" :min-width="canEdit ? 300 : 130">
      <template #default="{ row }">
        <div v-if="row.code" class="invite-code">
          <code>{{ row.code }}</code>
          <ElButton link type="primary" :disabled="isCopying" @click="copyCodes([row.code])">复制</ElButton>
        </div>
        <span v-else class="unavailable-code">{{ canEdit ? '旧记录无原码' : '仅管理员可见' }}</span>
      </template>
    </ElTableColumn>
    <ElTableColumn label="用户昵称" min-width="130" show-overflow-tooltip>
      <template #default="{ row }">{{ row.nickname ?? '—' }}</template>
    </ElTableColumn>
    <ElTableColumn label="邀请状态" min-width="100">
      <template #default="{ row }"><ElTag disable-transitions size="small" :type="row.redeemedAt && !row.revokedAt ? 'success' : 'info'">{{ state(row as Invite) }}</ElTag></template>
    </ElTableColumn>
    <ElTableColumn label="用户 AI" min-width="100">
      <template #default="{ row }">
        <ElTag v-if="row.userRevokedAt" disable-transitions size="small" type="info">已撤销</ElTag>
        <ElTag v-else-if="row.isAiDisabled === true" disable-transitions size="small" type="warning">已停用</ElTag>
        <ElTag v-else-if="row.isAiDisabled === false" disable-transitions size="small" type="success">已启用</ElTag>
        <span v-else>—</span>
      </template>
    </ElTableColumn>
    <ElTableColumn label="到期时间" min-width="170">
      <template #default="{ row }">{{ formatInviteDate(row.expiresAt) }}</template>
    </ElTableColumn>
    <ElTableColumn label="备注" min-width="155">
      <template #default="{ row }">
        <div class="invite-note">
          <span>{{ row.label || '—' }}</span>
          <ElButton v-if="canEdit" link type="primary" :disabled="isPending" @click="emit('editNote', row as Invite)">编辑</ElButton>
        </div>
      </template>
    </ElTableColumn>
    <ElTableColumn v-if="canEdit" label="操作" min-width="210">
      <template #default="{ row }">
        <ElPopconfirm
          v-if="row.userId && !row.userRevokedAt"
          :title="row.isAiDisabled ? '恢复该用户的 AI？' : '停用该用户的 AI？已派发的任务会继续。'"
          :confirm-button-text="row.isAiDisabled ? '确认恢复' : '确认停用'"
          cancel-button-text="取消"
          :width="236"
          @confirm="toggleUserAi(row as Invite)"
        >
          <template #reference>
            <ElButton link :type="row.isAiDisabled ? 'primary' : 'warning'" :disabled="isPending">
              {{ row.isAiDisabled ? '恢复 AI' : '停用 AI' }}
            </ElButton>
          </template>
        </ElPopconfirm>
        <ElButton v-if="row.redeemedAt && !row.revokedAt && !row.userRevokedAt" link :disabled="isPending" @click="emit('replace', row as Invite)">换机</ElButton>
        <ElPopconfirm v-if="!row.revokedAt" :title="row.redeemedAt ? '撤销此邀请和关联的 AI 身份？' : '撤销此邀请码？'" @confirm="emit('revoke', row.id)">
          <template #reference><ElButton link type="danger" :disabled="isPending">撤销</ElButton></template>
        </ElPopconfirm>
      </template>
    </ElTableColumn>
  </ElTable>
</template>

<style scoped>
.invite-code, .invite-note { display: flex; align-items: center; gap: 0.65rem; }
.invite-code code { font-family: ui-monospace, monospace; font-size: 0.8rem; user-select: all; }
.invite-note span { min-width: 0; overflow-wrap: anywhere; }
.unavailable-code { color: var(--color-muted); font-size: 0.8rem; }
.copy-error { margin: 0.6rem 1rem; }
</style>
