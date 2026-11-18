import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { AiAdminError } from '../api/ai-admin'
import { DEFAULT_ADMIN_USERNAME } from '../api/admin-users'
import { useAdminSessionStore } from '../stores/admin-session'
import { useAdminAction } from './use-admin-action'

export function useAiAdminAction() {
  const session = useAdminSessionStore()
  const router = useRouter()
  const action = useAdminAction()
  const canEdit = computed(() => session.session?.username === DEFAULT_ADMIN_USERNAME)

  function describe(error: unknown) {
    if (error instanceof AiAdminError) {
      if (error.status === 401) {
        session.clear()
        void router.replace({ name: 'login', query: { reason: 'expired' } })
      }
      return error.message
    }
    return '请求失败或超时，请重试。'
  }

  function run(job: (signal: AbortSignal) => Promise<void>) {
    return action.run(job, describe)
  }

  return { ...action, canEdit, run }
}
