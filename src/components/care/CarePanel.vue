<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useCareStore } from '../../stores/care'
import { SPECIES_LIST } from '../../config/species'
import { getSpeciesPreviewUrl } from '../../lib/speciesArt'
import type { SpeciesConfig } from '../../config/species'
import type { CareTask, CareTaskStatus, CareTaskType } from '../../lib/database'

const careStore = useCareStore()

const SPECIES_CARDS = SPECIES_LIST.map((species) => ({
  ...species,
  previewUrl: getSpeciesPreviewUrl(species.code),
}))

const TYPE_META: Record<CareTaskType, { icon: string, label: string }> = {
  water: { icon: '💧', label: '浇水' },
  sun: { icon: '☀️', label: '晒太阳' },
}

const STATUS_META: Record<CareTaskStatus, { text: string, tag: 'success' | 'warning' | 'danger' | 'info' }> = {
  pending: { text: '待提醒', tag: 'info' },
  reminded: { text: '待养护', tag: 'warning' },
  overdue: { text: '已逾期', tag: 'danger' },
  done: { text: '已完成', tag: 'success' },
  done_late: { text: '补做', tag: 'success' },
}

const selectedCode = ref<string>('')
const nickname = ref('')
const waterIntervalH = ref(72)
const sunIntervalH = ref(120)
const isAdopting = ref(false)

const selectedSpecies = computed<SpeciesConfig | undefined>(() =>
  SPECIES_LIST.find((species) => species.code === selectedCode.value),
)

function pickSpecies(species: SpeciesConfig): void {
  selectedCode.value = species.code
  waterIntervalH.value = species.waterIntervalH
  sunIntervalH.value = species.sunIntervalH
}

async function submitAdopt(): Promise<void> {
  const species = selectedSpecies.value
  if (!species) {
    ElMessage.warning('先选一株想领养的植物吧')
    return
  }
  const finalName = nickname.value.trim() || species.name
  const isIntervalValid = waterIntervalH.value >= 6 && sunIntervalH.value >= 6
  if (!isIntervalValid) {
    ElMessage.warning('养护间隔至少 6 小时哦')
    return
  }
  isAdopting.value = true
  try {
    await careStore.adopt({
      speciesCode: species.code,
      nickname: finalName,
      waterIntervalH: waterIntervalH.value,
      sunIntervalH: sunIntervalH.value,
    })
    nickname.value = ''
  } catch (err) {
    ElMessage.error(`领养失败：${String(err)}`)
  } finally {
    isAdopting.value = false
  }
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function typeLabel(type: CareTaskType): string {
  return `${TYPE_META[type].icon} ${TYPE_META[type].label}`
}

function statusText(status: CareTaskStatus): string {
  return STATUS_META[status].text
}

function statusTag(status: CareTaskStatus): 'success' | 'warning' | 'danger' | 'info' {
  return STATUS_META[status].tag
}

onMounted(() => {
  void careStore.init()
})

onUnmounted(() => {
  careStore.dispose()
})
</script>

<template>
  <section class="care">
    <div class="care-head">
      <h3 class="care-title">
        🌱 我的植物
        <template v-if="careStore.plant">
          · {{ careStore.plant.nickname }}
          <el-tag size="small" type="success" class="care-chip">{{ careStore.stageName }}</el-tag>
          <el-tag size="small" type="warning" class="care-chip">🔥 连击 {{ careStore.streakCurrent }} 天</el-tag>
        </template>
      </h3>
      <span class="care-balance">积分：{{ careStore.balance }} · 今日 +{{ careStore.todayEarned }}/20</span>
    </div>

    <template v-if="careStore.plant">
      <el-table v-if="careStore.tasks.length > 0" :data="careStore.tasks" size="small">
        <el-table-column label="任务" width="110">
          <template #default="{ row }">{{ typeLabel(row.type as CareTaskType) }}</template>
        </el-table-column>
        <el-table-column label="计划时间" min-width="140">
          <template #default="{ row }">{{ formatTime(row.scheduled_at as number) }}</template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="statusTag(row.status as CareTaskStatus)" size="small">
              {{ statusText(row.status as CareTaskStatus) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="90">
          <template #default="{ row }">
            <el-button
              size="small"
              :disabled="careStore.isSnoozing || row.snooze_count >= 3"
              @click="careStore.handleSnooze(row.id as number)"
            >
              稍后
            </el-button>
          </template>
        </el-table-column>
      </el-table>
      <p v-else class="care-empty">当前没有待养护任务，该干嘛干嘛~</p>
    </template>

    <div v-else class="adopt">
      <p class="adopt-tip">还没有领养植物，选一株带回家吧（桌面会生成它的数字分身）：</p>
      <div class="species-grid">
        <button
          v-for="species in SPECIES_CARDS"
          :key="species.code"
          type="button"
          class="species-card"
          :class="{ active: selectedCode === species.code }"
          @click="pickSpecies(species)"
        >
          <img v-if="species.previewUrl" class="species-thumb" :src="species.previewUrl" alt="" draggable="false" />
          <span v-else class="species-emoji">{{ species.emoji }}</span>
          <span class="species-name">{{ species.name }}</span>
          <span class="species-meta">
            💧{{ species.waterIntervalH / 24 }}天 · ☀️{{ species.sunIntervalH / 24 }}天
          </span>
        </button>
      </div>
      <div class="adopt-form">
        <el-input
          v-model="nickname"
          class="adopt-name"
          :placeholder="selectedSpecies ? `昵称（默认：${selectedSpecies.name}）` : '先选物种'"
          maxlength="12"
        />
        <span class="adopt-field">
          浇水间隔
          <el-input-number v-model="waterIntervalH" :min="6" :max="720" :step="24" size="small" />
          小时
        </span>
        <span class="adopt-field">
          晒太阳间隔
          <el-input-number v-model="sunIntervalH" :min="6" :max="720" :step="24" size="small" />
          小时
        </span>
        <el-button type="primary" :loading="isAdopting" @click="submitAdopt">领养</el-button>
      </div>
      <p v-if="!careStore.isLoaded" class="care-empty">数据加载中…</p>
    </div>
  </section>
</template>

<style scoped>
.care {
  margin-bottom: 18px;
}

.care-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.care-title {
  margin: 0;
  font-size: 15px;
}

.care-chip {
  margin-left: 6px;
}

.care-balance {
  font-size: 13px;
  color: #e6a23c;
  font-weight: 600;
}

.care-empty {
  margin: 0;
  font-size: 13px;
  color: #909399;
}

.adopt-tip {
  margin: 4px 0 10px;
  font-size: 13px;
  color: #606266;
}

.species-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  margin-bottom: 12px;
}

.species-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 10px 4px;
  border: 1.5px solid #dcdfe6;
  border-radius: 10px;
  background: #fff;
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
}

.species-card:hover {
  border-color: #95d475;
}

.species-card.active {
  border-color: #67c23a;
  box-shadow: 0 0 0 2px rgba(103, 194, 58, 0.2);
}

.species-thumb {
  width: 60px;
  height: 60px;
  object-fit: contain;
}

.species-emoji {
  font-size: 26px;
}

.species-name {
  font-size: 13px;
  font-weight: 600;
}

.species-meta {
  font-size: 11px;
  color: #909399;
}

.adopt-form {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}

.adopt-name {
  width: 180px;
}

.adopt-field {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #606266;
}
</style>
