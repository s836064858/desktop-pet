import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { emit, listen } from '@tauri-apps/api/event'
import { ElMessage } from 'element-plus'
import {
  createPlant,
  ensureSchema,
  getPlant,
  getPointsBalance,
  getStreak,
  getTodayPointsSum,
  listOpenTasks,
  resetPlant,
} from '../lib/database'
import type { CareTask, Plant, PlantAdoptInput } from '../lib/database'
import { emptyGrowthSnapshot, getGrowthSnapshot } from '../lib/growthRepository'
import { getGrowthStage } from '../lib/growth'

async function readSnapshot() {
  await ensureSchema()
  const nextPlant = await getPlant()
  const [nextTasks, nextBalance, nextToday, nextStreak, nextGrowth] = await Promise.all([
    nextPlant ? listOpenTasks(nextPlant.id) : Promise.resolve([]),
    getPointsBalance(),
    getTodayPointsSum(),
    getStreak(),
    nextPlant ? getGrowthSnapshot(nextPlant.id) : Promise.resolve(emptyGrowthSnapshot()),
  ])
  return { nextPlant, nextTasks, nextBalance, nextToday, nextStreak, nextGrowth }
}

export const useCareStore = defineStore('care', () => {
  const tasks = ref<CareTask[]>([])
  const balance = ref(0)
  const todayEarned = ref(0)
  const plant = ref<Plant | null>(null)
  const growth = ref(emptyGrowthSnapshot())
  const displayGrowthDays = computed(() => growth.value.previewDays ?? growth.value.days)
  const stage = computed(() => getGrowthStage(displayGrowthDays.value))
  const stageName = computed(() => stage.value.name)
  const loadError = ref('')
  const streakCurrent = ref(0)
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
    growth.value = snapshot.nextGrowth
    loadError.value = ''
    isLoaded.value = true
  }

  async function adopt(input: PlantAdoptInput): Promise<void> {
    refreshVersion += 1
    try {
      await createPlant(input)
    } finally {
      await refresh()
      await emit('plant-changed')
      await emit('care-changed')
    }
    ElMessage.success(`领养成功，${input.nickname} 已搬到桌面！`)
  }

  async function resetAdopted(): Promise<void> {
    refreshVersion += 1
    await resetPlant()
    refreshVersion += 1
    plant.value = null
    tasks.value = []
    growth.value = emptyGrowthSnapshot()
    await emit('plant-changed')
    await emit('care-changed')
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
    displayGrowthDays,
    growth,
    stage,
    loadError,
    streakCurrent,
    isLoaded,
    refresh,
    adopt,
    resetAdopted,
    init,
    dispose,
  }
})
