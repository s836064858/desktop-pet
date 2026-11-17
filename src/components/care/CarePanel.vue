<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, onUnmounted, shallowRef } from 'vue'
import { useCareStore } from '../../stores/care'
import { listSpeciesCards } from '../../lib/speciesRegistry'
import type { SpeciesCardItem } from '../../lib/speciesRegistry'
import { disposeSpeciesUrls } from '../../lib/spriteLibrary'
import PlantOverview from './PlantOverview.vue'
import CareTaskList from './CareTaskList.vue'
import PlantAdoption from './PlantAdoption.vue'
import SpeciesForgeDialog from './SpeciesForgeDialog.vue'
import PlantHabits from './PlantHabits.vue'

const GrowthDebugPanel = import.meta.env.DEV
  ? defineAsyncComponent(() => import('./GrowthDebugPanel.vue'))
  : null
const careStore = useCareStore()
const speciesCards = shallowRef<SpeciesCardItem[]>([])
const isForgeVisible = shallowRef(false)
const isLoadingSpecies = shallowRef(false)
const speciesError = shallowRef('')
const adoptedSpecies = computed(() =>
  speciesCards.value.find((item) => item.code === careStore.plant?.species_code),
)
let loadVersion = 0
let speciesController: AbortController | null = null

async function refreshCards(): Promise<void> {
  const version = ++loadVersion
  speciesController?.abort()
  const controller = new AbortController()
  speciesController = controller
  isLoadingSpecies.value = true
  speciesError.value = ''
  try {
    const cards = await listSpeciesCards({ signal: controller.signal })
    if (version === loadVersion) speciesCards.value = cards
  } catch {
    if (version === loadVersion) speciesError.value = '物种列表加载失败，请重试。'
  } finally {
    if (version === loadVersion) isLoadingSpecies.value = false
  }
}

onMounted(() => {
  void careStore.init()
  void refreshCards()
})
onUnmounted(() => {
  loadVersion += 1
  speciesController?.abort()
  disposeSpeciesUrls()
  careStore.dispose()
})
</script>

<template>
  <section aria-label="植物与养护">
    <div v-if="!careStore.isLoaded && !careStore.loadError" class="loading-state" role="status">
      <el-skeleton :rows="5" animated />
      <p class="muted">正在迎接你的植物伙伴…</p>
    </div>
    <div v-else-if="careStore.loadError" class="inline-note error-note" role="alert">
      {{ careStore.loadError }} <el-button text @click="careStore.refresh">重新加载</el-button>
    </div>
    <template v-else-if="careStore.plant">
      <p v-if="speciesError" class="inline-note error-note" role="alert">
        {{ speciesError }} <el-button text @click="refreshCards">重试</el-button>
      </p>
      <PlantOverview
        :plant="careStore.plant"
        :species="adoptedSpecies"
        :stage-name="careStore.stageName"
        :growth-days="careStore.displayGrowthDays"
        :has-interacted-today="careStore.growth.today?.is_complete === 1"
        :balance="careStore.balance"
        :today-earned="careStore.todayEarned"
        :streak-current="careStore.streakCurrent"
      />
      <PlantHabits v-if="careStore.growth.profile" :profile="careStore.growth.profile" />
      <CareTaskList
        v-if="careStore.growth.profile"
        :profile="careStore.growth.profile"
        :tasks="careStore.tasks"
      />
      <component
        :is="GrowthDebugPanel"
        v-if="GrowthDebugPanel"
        :key="careStore.plant.id"
        :plant-id="careStore.plant.id"
        :real-days="careStore.growth.days"
        :preview-days="careStore.growth.previewDays"
        @changed="careStore.refresh"
      />
    </template>
    <PlantAdoption
      v-else
      :species="speciesCards"
      :is-loading="isLoadingSpecies"
      :error="speciesError"
      @retry="refreshCards"
      @forge="isForgeVisible = true"
    />
    <SpeciesForgeDialog v-if="isForgeVisible" v-model="isForgeVisible" @saved="refreshCards" />
  </section>
</template>

<style scoped>
.loading-state {
  padding: 32px 0;
}
</style>
