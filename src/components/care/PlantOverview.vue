<script setup lang="ts">
import { computed } from 'vue'
import type { Plant } from '../../lib/database'
import { FULL_FORM_THRESHOLD } from '../../lib/database'
import type { SpeciesCardItem } from '../../lib/speciesRegistry'
import AppIcon from '../common/AppIcon.vue'

const props = defineProps<{
  plant: Plant
  species?: SpeciesCardItem
  stageName: string
  completedCount: number
  balance: number
  todayEarned: number
  streakCurrent: number
}>()
const adoptedDays = computed(() =>
  Math.max(1, Math.floor((Date.now() - props.plant.adopted_at) / 86400000) + 1),
)
const growthCount = computed(() => Math.min(props.completedCount, FULL_FORM_THRESHOLD))
const growthPercent = computed(() =>
  Math.min(100, Math.round((props.completedCount / FULL_FORM_THRESHOLD) * 100)),
)
const stats = computed(() => [
  { icon: 'leaf', label: '累计积分', value: props.balance, unit: '' },
  { icon: 'chart', label: '今日获得', value: props.todayEarned, unit: '/ 20' },
  { icon: 'calendar', label: '连续养护', value: props.streakCurrent, unit: '天' },
])
</script>
<template>
  <section aria-label="我的植物">
    <div class="plant-hero">
      <div class="plant-art">
        <span class="art-orbit" aria-hidden="true" />
        <img
          v-if="species?.previewUrl"
          :src="species.previewUrl"
          :alt="species.name"
          draggable="false"
        />
        <span v-else class="plant-placeholder">{{ species?.emoji || '🌱' }}</span>
      </div>
      <div class="plant-profile">
        <p class="eyebrow">我的植物</p>
        <div class="plant-heading">
          <h2>{{ plant.nickname }}</h2>
          <span class="stage-badge">{{ stageName }}</span>
        </div>
        <p class="plant-meta">
          {{ species?.name || '植物伙伴' }}<span>·</span>已领养 {{ adoptedDays }} 天
        </p>
        <div class="growth-block">
          <div class="growth-caption">
            <span>{{ growthPercent === 100 ? '已长成完全体' : '下一次成长' }}</span
            ><span
              ><strong>{{ growthCount }}</strong> / {{ FULL_FORM_THRESHOLD }} 次养护</span
            >
          </div>
          <el-progress
            :percentage="growthPercent"
            :stroke-width="7"
            :show-text="false"
            color="#c87955"
          />
        </div>
        <p class="plant-tip">去桌面摸摸它，或点 💧 / ☀️ 完成养护</p>
      </div>
    </div>
    <div class="plant-stats">
      <div v-for="stat in stats" :key="stat.label" class="stat-item">
        <span class="stat-icon"><AppIcon :name="stat.icon" :size="24" /></span>
        <div>
          <p class="stat-label">{{ stat.label }}</p>
          <p class="stat-value">
            {{ stat.value }} <span>{{ stat.unit }}</span>
          </p>
        </div>
      </div>
    </div>
  </section>
</template>
<style scoped>
.plant-hero {
  display: grid;
  grid-template-columns: 0.95fr 1.05fr;
  gap: 34px;
  align-items: center;
}
.plant-art {
  position: relative;
  display: grid;
  place-items: center;
  min-height: 225px;
  border-radius: 70px 30px 80px 20px;
  background: #e9eddf;
  overflow: hidden;
  isolation: isolate;
}
.plant-art::before,
.plant-art::after {
  content: '';
  position: absolute;
  width: 95px;
  height: 160px;
  border-radius: 100% 0 100% 0;
  background: #d7dfc8;
  transform: rotate(-30deg);
  bottom: -68px;
  left: -15px;
  z-index: -1;
}
.plant-art::after {
  left: auto;
  right: -20px;
  transform: rotate(40deg);
  bottom: -50px;
  background: #dfe5d3;
}
.plant-art img {
  width: min(100%, 235px);
  height: 225px;
  object-fit: contain;
  z-index: 1;
}
.art-orbit {
  position: absolute;
  bottom: 14px;
  width: 130px;
  height: 13px;
  background: #cfd8bc;
  border-radius: 50%;
  opacity: 0.55;
}
.plant-placeholder {
  font-size: 100px;
}
.plant-profile {
  min-width: 0;
}
.eyebrow {
  margin: 0 0 12px;
  font-size: 12px;
  color: var(--sprout-muted);
}
.plant-heading {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 14px;
}
.plant-heading h2 {
  margin: 0;
  font-size: clamp(28px, 4vw, 38px);
  line-height: 1.3;
  letter-spacing: 0.04em;
  overflow-wrap: anywhere;
}
.stage-badge {
  padding: 3px 10px;
  border: 1px solid #69866a;
  border-radius: 20px;
  font-size: 11px;
  white-space: nowrap;
}
.plant-meta {
  margin: 10px 0 0;
  color: #6e7868;
  font-size: 12px;
}
.plant-meta span {
  margin: 0 8px;
}
.growth-block {
  border-top: 1px solid var(--sprout-line);
  padding-top: 17px;
  margin-top: 19px;
}
.growth-caption {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 9px;
  font-size: 11px;
  color: #7b8275;
}
.growth-caption strong {
  color: var(--sprout-ink);
  font-size: 14px;
}
.plant-tip {
  margin: 14px 0 0;
  color: var(--sprout-muted);
  font-size: 11px;
  line-height: 1.7;
}
.plant-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  padding: 20px 0;
  margin: 20px 0 22px;
  border-block: 1px solid var(--sprout-line);
}
.stat-item {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
  border-right: 1px solid var(--sprout-line);
}
.stat-item:last-child {
  border: 0;
}
.stat-icon {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  background: #edf0e3;
  border-radius: 50%;
  color: #68834e;
}
.stat-label {
  margin: 0 0 5px;
  font-size: 11px;
  color: #6b7565;
}
.stat-value {
  margin: 0;
  font-size: 26px;
  font-weight: 650;
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
}
.stat-value span {
  font-size: 16px;
  font-weight: 400;
}
@media (max-width: 600px) {
  .plant-hero {
    gap: 18px;
  }
  .plant-art {
    min-height: 190px;
  }
  .plant-art img {
    height: 190px;
  }
  .stat-item {
    gap: 8px;
  }
  .stat-icon {
    width: 30px;
    height: 30px;
  }
  .stat-value {
    font-size: 22px;
  }
}
</style>
