<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import logoUrl from './assets/brand/logo.png'
import CarePanel from './components/care/CarePanel.vue'
import SettingsPanel from './components/settings/SettingsPanel.vue'
import { APP_ENGLISH_NAME, APP_NAME, APP_TAGLINE } from './config/brand'
import { silentAutoUpdate } from './lib/updater'

// 自动更新节奏（方案 D18）：启动 15s 后首查 + 每 6h 兜底；main 窗隐藏 ≠ 销毁，隐藏时照常运行
const AUTO_CHECK_DELAY = 15 * 1000
const AUTO_CHECK_INTERVAL = 6 * 60 * 60 * 1000
let autoCheckTimer: number | undefined
let autoCheckLoop: number | undefined

onMounted(() => {
  autoCheckTimer = window.setTimeout(() => void silentAutoUpdate(), AUTO_CHECK_DELAY)
  autoCheckLoop = window.setInterval(() => void silentAutoUpdate(), AUTO_CHECK_INTERVAL)
})
onUnmounted(() => {
  window.clearTimeout(autoCheckTimer)
  window.clearInterval(autoCheckLoop)
})
</script>

<template>
  <main class="page">
    <header class="page-header">
      <div class="page-brand">
        <img class="brand-logo" :src="logoUrl" alt="" width="44" height="44" />
        <div>
          <h1 class="page-title">
            {{ APP_NAME }} <span>{{ APP_ENGLISH_NAME }}</span>
          </h1>
          <p class="brand-tagline">{{ APP_TAGLINE }}</p>
        </div>
      </div>
      <span class="local-status"><i /> 本地运行</span>
    </header>
    <CarePanel />
    <SettingsPanel />
  </main>
</template>

<style scoped>
.page {
  max-width: 1040px;
  padding: 24px 28px 18px;
  margin: 0 auto;
}
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 22px;
}
.page-brand {
  display: flex;
  align-items: center;
  gap: 11px;
}
.brand-logo {
  object-fit: contain;
  flex-shrink: 0;
}
.page-title {
  margin: 0;
  font-size: 23px;
  letter-spacing: 0.06em;
  line-height: 1.3;
}
.page-title span {
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.04em;
  margin-left: 6px;
}
.brand-tagline {
  margin: 5px 0 0;
  color: var(--sprout-muted);
  font-size: 12px;
}
.local-status {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: var(--sprout-muted);
  font-size: 11px;
  white-space: nowrap;
}
.local-status i {
  width: 6px;
  height: 6px;
  background: #619551;
  border-radius: 50%;
}
@media (max-width: 600px) {
  .page {
    padding: 20px 18px;
  }
  .local-status {
    display: none;
  }
}
</style>
