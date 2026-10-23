<script setup lang="ts">
import { computed } from 'vue'
import { useCareStore } from '../../stores/care'
import { usePanelSettings } from '../../composables/usePanelSettings'
import AppIcon from '../common/AppIcon.vue'

const careStore = useCareStore()
const {
  isClickThrough,
  isAutostart,
  isLoading,
  isSaving,
  isResetting,
  loadError,
  loadSettings,
  changeSystemSetting,
  resetAdopted,
} = usePanelSettings()
const isDisabled = computed(() => isLoading.value || isSaving.value || Boolean(loadError.value))
</script>

<template>
  <section class="settings" aria-labelledby="settings-heading">
    <div class="section-heading"><h2 id="settings-heading" class="section-title">偏好设置</h2></div>
    <p v-if="loadError" class="inline-note error-note" role="alert">
      {{ loadError }} <el-button text @click="loadSettings">重新加载</el-button>
    </p>
    <div v-else class="settings-row" :aria-busy="isLoading || isSaving">
      <div class="setting-item">
        <span class="setting-label">开机自启</span
        ><el-switch
          aria-label="开机自启"
          :model-value="isAutostart"
          :disabled="isDisabled"
          @change="changeSystemSetting('autostart', Boolean($event))"
        />
      </div>
      <div class="setting-item">
        <span class="setting-label">鼠标穿透</span
        ><el-switch
          aria-label="鼠标穿透"
          :model-value="isClickThrough"
          :disabled="isDisabled"
          @change="changeSystemSetting('clickThrough', Boolean($event))"
        />
      </div>
    </div>
    <footer class="panel-footer">
      <span class="footer-hint"
        ><AppIcon name="info" :size="14" /> 关闭面板后，植物仍会陪在桌面</span
      >
      <el-button
        class="reset-action"
        text
        :loading="isResetting"
        :disabled="!careStore.plant || !careStore.isLoaded"
        @click="resetAdopted"
        ><AppIcon name="refresh" :size="14" /> 重新领养</el-button
      >
    </footer>
  </section>
</template>

<style scoped>
.settings {
  border-top: 1px solid var(--sprout-line);
  margin-top: 22px;
  padding-top: 18px;
}
.settings-row {
  display: flex;
  align-items: center;
  border: 1px solid var(--sprout-line);
  border-radius: 9px;
  padding: 12px 14px;
  gap: 18px;
  background: #fcfbf5;
}
.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex: 1;
  min-width: 0;
}
.setting-item + .setting-item {
  border-left: 1px solid var(--sprout-line);
  padding-left: 18px;
}
.setting-label {
  white-space: nowrap;
  font-size: 12px;
  color: #505b4d;
}
.panel-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 10px;
}
.footer-hint {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 10px;
  color: #8c9284;
}
.reset-action {
  color: #ba7657;
  padding-inline: 0;
  gap: 5px;
  font-size: 11px;
}
@media (max-width: 760px) {
  .settings-row {
    flex-wrap: wrap;
    gap: 10px 18px;
  }
  .setting-item:nth-child(2) {
    border: 0;
    padding-left: 0;
  }
}
</style>
