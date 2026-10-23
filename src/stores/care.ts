import { defineStore } from 'pinia'
import { ref } from 'vue'
import { emit, listen } from '@tauri-apps/api/event'
import { ElMessage } from 'element-plus'
import {
  createPlant,
  ensureSchema,
  getPlant,
  getPointsBalance,
  getStageFromCount,
  getStreak,
  getTodayPointsSum,
  getTotalCompletedCount,
  listOpenTasks,
  resetPlant,
  snoozeTask,
} from '../lib/database'
import type { CareTask, Plant, PlantAdoptInput } from '../lib/database'

async function readSnapshot() {
  await ensureSchema()
  const nextPlant = await getPlant()
  const [nextTasks, nextBalance, nextToday, nextStreak, nextCount] = await Promise.all([
    nextPlant ? listOpenTasks(nextPlant.id) : Promise.resolve([]),
    getPointsBalance(),
    getTodayPointsSum(),
    getStreak(),
    getTotalCompletedCount(),
  ])
  return { nextPlant, nextTasks, nextBalance, nextToday, nextStreak, nextCount }
}

export const useCareStore = defineStore('care', () => {
  const tasks = ref<CareTask[]>([])
  const balance = ref(0)
  const todayEarned = ref(0)
  const plant = ref<Plant | null>(null)
  const stageName = ref('成熟期')
  const completedCount = ref(0)
  const loadError = ref('')
  const streakCurrent = ref(0)
  const isSnoozing = ref(false)
  const isLoaded = ref(false)
  let unlisten: (() => void) | null = null
  let refreshVersion = 0
  let lifecycleVersion = 0

  async function refresh(): Promise<void> {
    const version = ++refreshVersion
    try {
      const snapshot = await readSnapshot()
      if (version !== refreshVersion) return
      applySnapshot(snapshot)
    } catch {
      if (version === refreshVersion) loadError.value = '养护数据加载失败，请重新加载。'
    }
  }

  function applySnapshot(snapshot: Awaited<ReturnType<typeof readSnapshot>>): void {
    plant.value = snapshot.nextPlant
    tasks.value = snapshot.nextTasks
    balance.value = snapshot.nextBalance
    todayEarned.value = snapshot.nextToday
    streakCurrent.value = snapshot.nextStreak.currentCount
    completedCount.value = snapshot.nextCount
    stageName.value = getStageFromCount(snapshot.nextCount).name
    loadError.value = ''
    isLoaded.value = true
  }

  async function adopt(input: PlantAdoptInput): Promise<void> {
    plant.value = await createPlant(input)
    tasks.value = []
    await emit('plant-changed')
    await emit('care-changed')
    ElMessage.success(`领养成功，${input.nickname} 已搬到桌面！`)
  }

  async function resetAdopted(): Promise<void> {
    await resetPlant()
    plant.value = null
    tasks.value = []
    await emit('plant-changed')
    await emit('care-changed')
  }

  async function handleSnooze(taskId: number): Promise<void> {
    if (isSnoozing.value) {
      return
    }
    isSnoozing.value = true
    try {
      const isOk = await snoozeTask(taskId)
      if (!isOk) {
        ElMessage.warning('已经推迟 3 次啦，不能再拖了')
      }
      await refresh()
    } catch (err) {
      ElMessage.error(`推迟失败：${String(err)}`)
    } finally {
      isSnoozing.value = false
    }
  }

  async function init(): Promise<void> {
    const version = ++lifecycleVersion
    try {
      const stop = await listen('care-changed', () => {
        void refresh()
      })
      if (version !== lifecycleVersion) {
        stop()
        return
      }
      unlisten?.()
      unlisten = stop
      await refresh()
    } catch {
      if (version === lifecycleVersion) loadError.value = '养护数据连接失败，请重新打开面板。'
    }
  }

  function dispose(): void {
    lifecycleVersion += 1
    refreshVersion += 1
    if (unlisten) {
      unlisten()
      unlisten = null
    }
  }

  return {
    tasks,
    balance,
    todayEarned,
    plant,
    stageName,
    completedCount,
    loadError,
    streakCurrent,
    isSnoozing,
    isLoaded,
    refresh,
    adopt,
    resetAdopted,
    handleSnooze,
    init,
    dispose,
  }
})
