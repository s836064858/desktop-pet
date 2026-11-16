import { getCurrentWindow } from '@tauri-apps/api/window'
import type { UnlistenFn } from '@tauri-apps/api/event'
import { error as logError, info } from '@tauri-apps/plugin-log'
import { showPanelWindow } from './capabilities'

function createReopenHandler({ signal }: { signal: AbortSignal }): () => Promise<void> {
  let isOpening = false

  return async function handleReopen(): Promise<void> {
    if (signal.aborted || isOpening) {
      return
    }
    isOpening = true
    try {
      await showPanelWindow()
      if (!signal.aborted) {
        void info('[panel] 已唤起现有面板')
      }
    } catch (error) {
      if (!signal.aborted) {
        void logError(`[panel] 重新打开面板失败：${String(error)}`)
      }
    } finally {
      isOpening = false
    }
  }
}

// 在面板挂载前接收系统事件；关闭面板只隐藏，页面卸载时才释放监听。
export async function initAppReopen(): Promise<void> {
  const controller = new AbortController()
  let unlisten: UnlistenFn | undefined

  function dispose(): void {
    controller.abort()
    unlisten?.()
    unlisten = undefined
    window.removeEventListener('pagehide', dispose)
  }

  window.addEventListener('pagehide', dispose, { once: true })
  try {
    unlisten = await getCurrentWindow().listen('app-reopen', createReopenHandler({ signal: controller.signal }))
    if (controller.signal.aborted) {
      dispose()
    }
  } catch (error) {
    dispose()
    throw error
  }
}
