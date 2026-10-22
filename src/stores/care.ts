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

export const useCareStore = defineStore('care', () => {
  const tasks = ref<CareTask[]>([])
  const balance = ref(0)
  const todayEarned = ref(0)
  const plant = ref<Plant | null>(null)
  const stageName = ref('成熟期')
  const streakCurrent = ref(0)
  const isSnoozing = ref(false)
  const isLoaded = ref(false)
  let unlisten: (() => void) | null = null

  async function refresh(): Promise<void> {
    try {
      await ensureSchema()
      plant.value = await getPlant()
      tasks.value = plant.value ? await listOpenTasks(plant.value.id) : []
      balance.value = await getPointsBalance()
      todayEarned.value = await getTodayPointsSum()
      streakCurrent.value = (await getStreak()).currentCount
      stageName.value = getStageFromCount(await getTotalCompletedCount()).name
      isLoaded.value = true
    } catch (err) {
      ElMessage.error(`养护数据加载失败：${String(err)}`)
    }
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
    unlisten = await listen('care-changed', () => {
      void refresh()
    })
    await refresh()
  }

  function dispose(): void {
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
