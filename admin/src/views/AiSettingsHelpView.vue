<script setup lang="ts">
import { RouterLink } from 'vue-router'
import AdminPageHeader from '../components/AdminPageHeader.vue'
import AiSetupGuide from '../components/AiSetupGuide.vue'
import AiSettingsTroubleshooting from '../components/AiSettingsTroubleshooting.vue'

const topics = [
  { id: 'ark-setup', label: '火山方舟' },
  { id: 'tos-setup', label: 'TOS 素材存储' },
  { id: 'desktop-check', label: '桌面端验证' },
  { id: 'ai-troubleshooting', label: '常见问题' },
]
</script>

<template>
  <section class="help-view">
    <AdminPageHeader title="AI 设置帮助" section="服务管理">
      <template #actions>
        <RouterLink class="el-button" :to="{ name: 'ai-settings' }">返回 AI 设置</RouterLink>
      </template>
    </AdminPageHeader>
    <p class="help-intro">
      使用默认管理员 <code>admin</code> 保存配置。方舟负责对话和生图，TOS 存放生成的图片。
    </p>
    <nav class="help-topics" aria-label="帮助目录">
      <a v-for="topic in topics" :key="topic.id" :href="`#${topic.id}`">{{ topic.label }}</a>
    </nav>
    <div class="help-layout">
      <AiSetupGuide />
      <AiSettingsTroubleshooting />
    </div>
  </section>
</template>

<style scoped>
.help-view { max-width: 68rem; }
.help-intro { margin: -0.6rem 0 1rem; color: var(--color-muted); font-size: 0.92rem; }
.help-topics { display: flex; flex-wrap: wrap; gap: 0.45rem; margin-bottom: 1.25rem; }
.help-topics a {
  padding: 0.42rem 0.7rem;
  border: 1px solid var(--color-line);
  border-radius: 6px;
  background: var(--color-surface);
  color: var(--el-color-primary-dark-2);
  text-decoration: none;
  font-size: 0.84rem;
}
.help-topics a:hover { background: var(--color-selection); }
.help-layout { display: grid; grid-template-columns: minmax(0, 2.1fr) minmax(15rem, 1fr); gap: 1rem; align-items: start; }
@media (max-width: 1060px) {
  .help-layout { grid-template-columns: minmax(0, 1fr); gap: 0; }
}
</style>
