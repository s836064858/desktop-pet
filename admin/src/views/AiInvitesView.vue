<script setup lang="ts">
import { ElButton } from 'element-plus'
import { onMounted, shallowRef } from 'vue'
import { AiAdminError, aiAdmin } from '../api/ai-admin'
import type { Invite, IssuedInvite, IssueInvitesInput } from '../api/ai-admin'
import AdminPageHeader from '../components/AdminPageHeader.vue'
import AppIcon from '../../../src/components/common/AppIcon.vue'
import InviteIssueForm from '../components/InviteIssueForm.vue'
import InviteNoteDialog from '../components/InviteNoteDialog.vue'
import InviteTable from '../components/InviteTable.vue'
import { useAiAdminAction } from '../composables/use-ai-admin-action'

const { isPending, errorMessage, canEdit, clearError, run } = useAiAdminAction()
const rows = shallowRef<Invite[] | null>(null)
const batchIds = shallowRef<string[]>([])
const editingNote = shallowRef<Invite | null>(null)
const replacement = shallowRef<{ userId: string; nickname: string | null } | null>(null)

async function refresh(signal: AbortSignal): Promise<void> {
  const data = await aiAdmin<Invite[]>('/invites', signal)
  signal.throwIfAborted()
  rows.value = data
}

function load() { return run(refresh) }

async function generate(input: IssueInvitesInput, signal: AbortSignal): Promise<IssuedInvite[]> {
  try {
    return await aiAdmin<IssuedInvite[]>('/invites/batch', signal, 'POST', input)
  } catch (error) {
    signal.throwIfAborted()
    if (error instanceof AiAdminError && error.status < 500) throw error
    throw new AiAdminError(0, '暂时无法确认生成结果，请先刷新邀请记录，再决定是否重试。')
  }
}

function issue(input: IssueInvitesInput) {
  return run(async (signal) => {
    const result = await generate(input, signal)
    signal.throwIfAborted()
    batchIds.value = result.map(({ id }) => id)
    replacement.value = null
    try {
      await refresh(signal)
    } catch (error) {
      signal.throwIfAborted()
      if (error instanceof AiAdminError && error.status === 401) throw error
      throw new AiAdminError(0, `已生成 ${result.length} 个邀请码，记录加载失败，请刷新。`)
    }
  })
}

function editNote(invite: Invite): void {
  clearError()
  editingNote.value = invite
}

function closeNote(): void {
  editingNote.value = null
  clearError()
}

function saveNote(label: string) {
  const id = editingNote.value?.id
  if (!id) return
  return run(async (signal) => {
    await aiAdmin(`/invites/${encodeURIComponent(id)}/note`, signal, 'PUT', { label })
    signal.throwIfAborted()
    rows.value = rows.value?.map((row) => row.id === id ? { ...row, label } : row) ?? null
    closeNote()
  })
}

function revoke(id: string) {
  return run(async (signal) => {
    await aiAdmin(`/invites/${encodeURIComponent(id)}/revoke`, signal, 'POST')
    await refresh(signal)
  })
}

function setUserStatus({ userId, isAiDisabled }: { userId: string; isAiDisabled: boolean }) {
  return run(async (signal) => {
    await aiAdmin(`/users/${encodeURIComponent(userId)}/status`, signal, 'PUT', { isAiDisabled })
    signal.throwIfAborted()
    rows.value = rows.value?.map((row) => row.userId === userId ? { ...row, isAiDisabled } : row) ?? null
  })
}

function replace(invite: Invite): void {
  if (invite.userId) replacement.value = { userId: invite.userId, nickname: invite.nickname }
}

onMounted(load)
</script>

<template>
  <section>
    <AdminPageHeader title="邀请管理" section="访问管理">
      <template #actions><ElButton :disabled="isPending" @click="load"><AppIcon name="refresh" :size="15" />刷新</ElButton></template>
    </AdminPageHeader>
    <div v-if="canEdit" class="ops-panel">
      <div class="ops-heading"><h2>发放邀请</h2></div>
      <InviteIssueForm :is-pending="isPending" :replacement="replacement" @issue="issue" @clear="replacement = null" />
    </div>
    <p v-if="errorMessage && !editingNote" class="form-error" role="alert">{{ errorMessage }}</p>
    <div v-if="rows" class="ops-panel ops-panel--table">
      <InviteTable
        :rows="rows"
        :batch-ids="batchIds"
        :is-pending="isPending"
        :can-edit="canEdit"
        @revoke="revoke"
        @replace="replace"
        @edit-note="editNote"
        @set-user-status="setUserStatus"
      />
    </div>
    <p v-else-if="isPending" role="status">正在加载邀请…</p>
    <InviteNoteDialog
      v-if="editingNote"
      :initial-label="editingNote.label"
      :is-pending="isPending"
      :error-message="errorMessage"
      @close="closeNote"
      @save="saveNote"
    />
  </section>
</template>
