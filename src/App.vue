<script setup lang="ts">
import logoUrl from './assets/brand/logo.png'
import CarePanel from './components/care/CarePanel.vue'
import SettingsPanel from './components/settings/SettingsPanel.vue'
import { APP_ENGLISH_NAME, APP_NAME, APP_TAGLINE } from './config/brand'
</script>

<template>
  <div class="page">
    <header class="page-header">
      <div class="page-brand">
        <img class="brand-logo" :src="logoUrl" alt="" width="48" height="48" />
        <div>
          <h1 class="page-title">
            {{ APP_NAME }} <span class="brand-english">{{ APP_ENGLISH_NAME }}</span>
          </h1>
          <p class="brand-tagline">{{ APP_TAGLINE }}</p>
        </div>
      </div>
      <p class="page-desc">
        桌面上的小植物是主角：鼠标悬浮它会出现 💧/☀️，点一下完成养护。这里管理领养与设置。
      </p>
    </header>
    <CarePanel />
    <SettingsPanel />
  </div>
</template>

<style scoped>
.page {
  max-width: 780px;
  margin: 0 auto;
  padding: 20px 24px;
}

.page-header {
  margin-bottom: 14px;
}

.page-brand {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
}

.brand-logo {
  flex-shrink: 0;
  object-fit: contain;
}

.page-title {
  margin: 0;
  color: #145c43;
  font-size: 22px;
  line-height: 1.4;
}

.brand-english {
  margin-left: 6px;
  font-size: 14px;
  font-weight: 500;
}

.brand-tagline {
  margin: 3px 0 0;
  color: #909399;
  font-size: 12px;
}

.page-desc {
  margin: 0;
  color: #909399;
  font-size: 13px;
  line-height: 1.6;
}
</style>
