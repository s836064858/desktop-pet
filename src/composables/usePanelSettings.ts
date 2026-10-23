import { onMounted, onUnmounted, shallowRef } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  isAutostartOn,
  setAutostart,
  setPetClickThrough,
} from '../lib/capabilities'
import { useCareStore } from '../stores/care'

export function usePanelSettings() {
  const careStore = useCareStore()
  const isClickThrough = shallowRef(false)
  const isAutostart = shallowRef(false)
  const isLoading = shallowRef(false)
  const isSaving = shallowRef(false)
  const isResetting = shallowRef(false)
  const loadError = shallowRef('')
  let isActive = true

  async function loadSettings(): Promise<void> {
    if (isLoading.value || !isActive) return
    isLoading.value = true
    loadError.value = ''
    try {
      const autostart = await isAutostartOn()
      if (!isActive) return
      isAutostart.value = autostart
    } catch {
      if (isActive) loadError.value = '偏好设置加载失败，请重试。'
    } finally {
      if (isActive) isLoading.value = false
    }
  }

  async function changeSystemSetting(
    type: 'autostart' | 'clickThrough',
    value: boolean,
  ): Promise<void> {
    if (isSaving.value || isLoading.value) return
    isSaving.value = true
    try {
      await (type === 'autostart' ? setAutostart(value) : setPetClickThrough(value))
      if (!isActive) return
      if (type === 'autostart') isAutostart.value = value
      else isClickThrough.value = value
    } catch {
      if (isActive) ElMessage.error('切换失败，请重试。')
    } finally {
      if (isActive) isSaving.value = false
    }
  }

  async function confirmReset(): Promise<boolean> {
    try {
      await ElMessageBox.confirm(
        '将送别当前植物并删除它的养护任务，积分保留。确定重新领养吗？',
        '重新领养',
        { type: 'warning', confirmButtonText: '确定送别', cancelButtonText: '再陪一会儿' },
      )
      return isActive
    } catch {
      return false
    }
  }

  async function resetAdopted(): Promise<void> {
    if (isResetting.value || !careStore.plant) return
    isResetting.value = true
    try {
      if (!(await confirmReset())) return
      await careStore.resetAdopted()
      if (isActive) ElMessage.success('已送别，可以迎接新的植物伙伴了。')
    } catch {
      if (isActive) ElMessage.error('送别失败，请重试。')
    } finally {
      if (isActive) isResetting.value = false
    }
  }

  onMounted(() => {
    void loadSettings()
  })
  onUnmounted(() => {
    isActive = false
  })
  return {
    isClickThrough,
    isAutostart,
    isLoading,
    isSaving,
    isResetting,
    loadError,
    loadSettings,
    changeSystemSetting,
    resetAdopted,
  }
}
