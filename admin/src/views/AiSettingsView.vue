<script setup lang="ts">
import { RouterLink } from 'vue-router'
import AppIcon from '../../../src/components/common/AppIcon.vue'
import AdminPageHeader from '../components/AdminPageHeader.vue'
import AiServiceSettings from '../components/AiServiceSettings.vue'
import TosSettingsPanel from '../components/TosSettingsPanel.vue'
</script>

<template>
  <section class="settings-view">
    <AdminPageHeader title="AI 设置" section="服务管理">
      <template #actions>
        <RouterLink class="el-button" :to="{ name: 'ai-settings-help' }">
          <AppIcon name="info" :size="16" />配置帮助
        </RouterLink>
      </template>
    </AdminPageHeader>
    <AiServiceSettings />
    <TosSettingsPanel />
  </section>
</template>

<style scoped>
.settings-view { max-width: 54rem; }
</style>
