<script setup lang="ts">
import type { CareProfile } from '../../lib/careProfile'
import HabitDescription from './HabitDescription.vue'
defineProps<{ profile: CareProfile }>()
</script>

<template>
  <section class="plant-habits" aria-label="植物习性">
    <div class="section-heading">
      <h2 class="section-title">植物习性</h2>
      <span class="muted"
        >浇水每 {{ profile.waterEveryDays }} 天 · 光照每 {{ profile.lightEveryDays }} 天</span
      >
    </div>
    <HabitDescription :description="profile.description" />
  </section>
</template>

<style scoped>
.plant-habits {
  margin: 18px 0;
  padding-bottom: 18px;
  border-bottom: 1px solid var(--sprout-line);
}
.plant-habits .section-heading {
  gap: 12px;
  margin-bottom: 10px;
  flex-wrap: wrap;
}
</style>
