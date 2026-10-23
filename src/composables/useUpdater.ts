import { onMounted, shallowRef } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getCurrentVersion, installUpdate, probeUpdate, type Update } from '../lib/updater'

export type UpdatePhase = 'idle' | 'checking' | 'downloading'

/** 设置面板「检查更新」交互：与 lib/updater 的静默自动路径不同，这里每一步都给用户反馈 */
export function useUpdater() {
  const currentVersion = shallowRef('')
  const phase = shallowRef<UpdatePhase>('idle')

  onMounted(() => {
    void getCurrentVersion().then((v) => (currentVersion.value = v))
  })

  async function checkForUpdate(): Promise<void> {
    if (phase.value !== 'idle') return
    phase.value = 'checking'
    try {
      const update = await probeUpdate()
      if (!update) {
        ElMessage.success(`已是最新版本（v${currentVersion.value || '…'}）`)
        return
      }
      if (!(await confirmUpdate(update))) return
      phase.value = 'downloading'
      ElMessage.info('正在下载更新，完成后将自动重启…')
      await installUpdate(update)
    } catch {
      ElMessage.error('更新失败，请稍后重试。')
    } finally {
      phase.value = 'idle'
    }
  }

  async function confirmUpdate(update: Update): Promise<boolean> {
    try {
      await ElMessageBox.confirm(
        `发现新版本 v${update.version}，更新完成后应用会自动重启。现在更新吗？`,
        '发现新版本',
        { type: 'success', confirmButtonText: '立即更新', cancelButtonText: '暂不' },
      )
      return true
    } catch {
      return false
    }
  }

  return { currentVersion, phase, checkForUpdate }
}
