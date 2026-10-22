<script setup lang="ts">
import CarePanel from './components/care/CarePanel.vue'
import SettingsPanel from './components/settings/SettingsPanel.vue'
</script>

<template>
  <div class="page">
    <header class="page-header">
      <h2 class="page-title">植物分身</h2>
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

.page-title {
  margin: 0 0 6px;
  font-size: 18px;
}

.page-desc {
  margin: 0;
  color: #909399;
  font-size: 13px;
  line-height: 1.6;
}
</style>
