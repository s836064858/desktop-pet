<script setup lang="ts">
import { computed, onUnmounted, shallowRef } from 'vue'
import { useCareStore } from '../../stores/care'
import type { SpeciesCardItem } from '../../lib/speciesRegistry'
import AppIcon from '../common/AppIcon.vue'

const props = defineProps<{ species: SpeciesCardItem[]; isLoading: boolean; error: string }>()
defineEmits<{ forge: []; retry: [] }>()
const careStore = useCareStore()
const selectedCode = shallowRef('')
const nickname = shallowRef('')
const waterIntervalH = shallowRef<number | undefined>(72)
const sunIntervalH = shallowRef<number | undefined>(120)
const isAdopting = shallowRef(false)
const formError = shallowRef('')
const selectedSpecies = computed(() =>
  props.species.find((item) => item.code === selectedCode.value),
)
let isActive = true
onUnmounted(() => {
  isActive = false
})

function pickSpecies(species: SpeciesCardItem): void {
  selectedCode.value = species.code
  waterIntervalH.value = species.waterIntervalH
  sunIntervalH.value = species.sunIntervalH
  formError.value = ''
}

async function submitAdopt(): Promise<void> {
  if (isAdopting.value) return
  const species = selectedSpecies.value
  if (!species) {
    formError.value = '先选一株想领养的植物吧。'
    return
  }
  const water = waterIntervalH.value
  const sun = sunIntervalH.value
  if (
    !water ||
    !sun ||
    !Number.isFinite(water) ||
    !Number.isFinite(sun) ||
    water < 6 ||
    sun < 6 ||
    water > 720 ||
    sun > 720
  ) {
    formError.value = '养护间隔请填写 6～720 小时。'
    return
  }
  isAdopting.value = true
  formError.value = ''
  try {
    await careStore.adopt({
      speciesCode: species.code,
      nickname: nickname.value.trim() || species.name,
      waterIntervalH: water,
      sunIntervalH: sun,
    })
  } catch {
    if (isActive) formError.value = '领养失败，请稍后重试。'
  } finally {
    if (isActive) isAdopting.value = false
  }
}
</script>
<template>
  <section class="adoption">
    <div class="adoption-intro">
      <div>
        <p class="eyebrow">一段陪伴，从这里开始</p>
        <h2>选一株，带回你的桌面</h2>
        <p class="muted">按时照顾，慢慢长大。每一株都有自己的模样。</p>
      </div>
      <el-button class="forge-entry" :disabled="isAdopting" @click="$emit('forge')"
        ><AppIcon name="sparkles" :size="16" /> AI 生成新物种</el-button
      >
    </div>
    <p v-if="error" class="inline-note error-note" role="alert">
      {{ error }} <el-button text @click="$emit('retry')">重新加载</el-button>
    </p>
    <el-skeleton v-else-if="isLoading" :rows="3" animated />
    <p v-else-if="!species.length" class="inline-note">还没有可用物种，可以先用 AI 生成一株。</p>
    <div v-else class="species-grid" aria-label="选择植物">
      <button
        v-for="item in species"
        :key="item.code"
        type="button"
        class="species-card"
        :class="{ 'is-selected': selectedCode === item.code }"
        :aria-pressed="selectedCode === item.code"
        :disabled="isAdopting"
        @click="pickSpecies(item)"
      >
        <span v-if="selectedCode === item.code" class="selected-mark"
          ><AppIcon name="check" :size="12"
        /></span>
        <img v-if="item.previewUrl" :src="item.previewUrl" alt="" draggable="false" />
        <span v-else class="species-placeholder">{{ item.emoji }}</span>
        <span class="species-name">{{ item.name }} <small v-if="item.isCustom">AI</small></span>
        <span class="species-meta">浇水 {{ item.waterIntervalH / 24 }} 天</span>
      </button>
    </div>
    <form class="adopt-form" @submit.prevent="submitAdopt">
      <label class="field-label name-field"
        ><span>给它起个名字</span
        ><el-input
          v-model="nickname"
          :placeholder="selectedSpecies ? '默认：' + selectedSpecies.name : '先选一株植物吧'"
          maxlength="12"
          :disabled="isAdopting"
      /></label>
      <label class="field-label"
        ><span>浇水间隔 / 小时</span
        ><el-input-number
          v-model="waterIntervalH"
          :min="6"
          :max="720"
          :step="24"
          :disabled="isAdopting"
      /></label>
      <label class="field-label"
        ><span>晒太阳间隔 / 小时</span
        ><el-input-number
          v-model="sunIntervalH"
          :min="6"
          :max="720"
          :step="24"
          :disabled="isAdopting"
      /></label>
      <el-button
        type="primary"
        native-type="submit"
        :loading="isAdopting"
        :disabled="isLoading || !selectedSpecies"
        >确认领养</el-button
      >
    </form>
    <p v-if="formError" class="inline-note error-note" role="alert">{{ formError }}</p>
  </section>
</template>
<style scoped>
.adoption-intro {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  margin: 8px 0 24px;
}
.eyebrow {
  margin: 0 0 8px;
  font-size: 11px;
  color: #8b967c;
}
.adoption-intro h2 {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
}
.adoption-intro .muted {
  margin-bottom: 0;
}
.forge-entry {
  gap: 7px;
  color: #52754e;
  border-color: #b6c3a6;
}
.species-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(115px, 1fr));
  gap: 12px;
  max-height: 330px;
  overflow: auto;
  padding: 4px;
  margin: -4px;
}
.species-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 14px 8px 12px;
  border: 1px solid #e2e4d8;
  border-radius: 12px;
  background: #fdfcf7;
  color: var(--sprout-ink);
  cursor: pointer;
  transition:
    border-color 0.15s,
    background-color 0.15s;
}
.species-card:hover {
  border-color: #9bab84;
}
.species-card.is-selected {
  background: #edf1e4;
  border-color: #6f8a58;
}
.species-card img {
  width: 105px;
  max-width: 100%;
  height: 110px;
  object-fit: contain;
}
.species-placeholder {
  height: 110px;
  display: grid;
  place-items: center;
  font-size: 50px;
}
.species-name {
  margin-top: 8px;
  font-size: 13px;
  font-weight: 600;
}
.species-name small {
  font-size: 9px;
  font-weight: 500;
  color: #81986c;
}
.species-meta {
  margin-top: 6px;
  font-size: 10px;
  color: #8b927f;
}
.selected-mark {
  position: absolute;
  top: 8px;
  right: 8px;
  display: grid;
  place-items: center;
  width: 18px;
  height: 18px;
  background: #698452;
  color: white;
  border-radius: 50%;
}
.adopt-form {
  display: flex;
  align-items: end;
  gap: 12px;
  margin: 22px 0 12px;
  padding-top: 20px;
  border-top: 1px solid var(--sprout-line);
}
.name-field {
  flex: 1;
  min-width: 120px;
}
.adopt-form .el-input-number {
  width: 135px;
}
@media (max-width: 700px) {
  .adopt-form {
    flex-wrap: wrap;
  }
  .name-field {
    flex-basis: 100%;
  }
  .adoption-intro {
    align-items: start;
    flex-direction: column;
    gap: 12px;
  }
}
</style>
