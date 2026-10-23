<script setup lang="ts">
import { computed, onMounted, onUnmounted, shallowRef } from 'vue'
import { useCareStore } from '../../stores/care'
import { listSpeciesCards } from '../../lib/speciesRegistry'
import type { SpeciesCardItem } from '../../lib/speciesRegistry'
import PlantOverview from './PlantOverview.vue'
import CareTaskList from './CareTaskList.vue'
import PlantAdoption from './PlantAdoption.vue'
import SpeciesForgeDialog from './SpeciesForgeDialog.vue'

const careStore = useCareStore()
const speciesCards = shallowRef<SpeciesCardItem[]>([])
const isForgeVisible = shallowRef(false)
const isLoadingSpecies = shallowRef(false)
const speciesError = shallowRef('')
const adoptedSpecies = computed(() =>
  speciesCards.value.find((item) => item.code === careStore.plant?.species_code),
)
let loadVersion = 0

async function refreshCards(): Promise<void> {
  const version = ++loadVersion
  isLoadingSpecies.value = true
  speciesError.value = ''
  try {
    const cards = await listSpeciesCards()
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
      <PlantOverview
        :plant="careStore.plant"
        :species="adoptedSpecies"
        :stage-name="careStore.stageName"
        :completed-count="careStore.completedCount"
        :balance="careStore.balance"
        :today-earned="careStore.todayEarned"
        :streak-current="careStore.streakCurrent"
      />
      <CareTaskList
        :tasks="careStore.tasks"
        :is-snoozing="careStore.isSnoozing"
        @snooze="careStore.handleSnooze"
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
