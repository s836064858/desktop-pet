<script setup lang="ts">
import type { CareProfile } from '../../lib/careProfile'
import HabitDescription from './HabitDescription.vue'

defineProps<{ modelValue: CareProfile; isDisabled?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: CareProfile] }>()

function updateFrequency(
  profile: CareProfile,
  key: 'waterEveryDays' | 'lightEveryDays',
  value: number | undefined,
): void {
  emit('update:modelValue', { ...profile, [key]: value })
}
</script>

<template>
  <fieldset class="care-frequency" :disabled="isDisabled">
    <legend>养护节奏</legend>
    <div class="frequencies">
      <label class="field-label"
        ><span>浇水 · 每几天一次</span>
        <el-input-number
          :model-value="modelValue.waterEveryDays"
          :min="1"
          :max="30"
          :precision="0"
          :disabled="isDisabled"
          @update:model-value="updateFrequency(modelValue, 'waterEveryDays', $event)"
        />
      </label>
      <label class="field-label"
        ><span>光照 · 每几天一次</span>
        <el-input-number
          :model-value="modelValue.lightEveryDays"
          :min="1"
          :max="30"
          :precision="0"
          :disabled="isDisabled"
          @update:model-value="updateFrequency(modelValue, 'lightEveryDays', $event)"
        />
      </label>
    </div>
    <HabitDescription :description="modelValue.description" />
    <p class="muted">频率是默认养护节奏，可按实际环境调整后确认。</p>
  </fieldset>
</template>

<style scoped>
.care-frequency {
  border: 1px solid var(--sprout-line);
  border-radius: 12px;
  padding: 16px;
  margin: 18px 0;
  display: grid;
  gap: 14px;
  min-width: 0;
}
.care-frequency legend {
  padding-inline: 6px;
  font-weight: 600;
  color: #456746;
}
.frequencies {
  display: flex;
  gap: 24px;
  flex-wrap: wrap;
}
.care-frequency p {
  margin: 0;
}
</style>
