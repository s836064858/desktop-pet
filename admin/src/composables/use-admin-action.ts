import { onScopeDispose, readonly, shallowRef } from 'vue'

export function useAdminAction() {
  const isPending = shallowRef(false)
  const errorMessage = shallowRef('')
  let controller: AbortController | undefined

  function clearError(): void {
    errorMessage.value = ''
  }

  async function run(
    action: (signal: AbortSignal) => Promise<void>,
    describe: (error: unknown) => string,
  ): Promise<boolean> {
    if (controller) return false
    const active = new AbortController()
    controller = active
    isPending.value = true
    clearError()

    try {
      await action(active.signal)
      return !active.signal.aborted
    } catch (error) {
      if (!active.signal.aborted) errorMessage.value = describe(error)
      return false
    } finally {
      controller = undefined
      isPending.value = false
    }
  }

  onScopeDispose(() => controller?.abort())
  return { isPending: readonly(isPending), errorMessage: readonly(errorMessage), clearError, run }
}
