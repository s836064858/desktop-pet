<script setup lang="ts">
import AppIcon from '../../../src/components/common/AppIcon.vue'

const questions = [
  {
    title: '方舟对话验证失败',
    answer: '检查 Key 是否完整有效，所在项目是否已开通对话模型，并确认 Key 有模型调用权限。若提示连接失败，检查 AI 服务所在机器能否访问火山方舟。',
  },
  {
    title: 'TOS 验证失败',
    answer: '先核对桶名、地域 ID 和配对的访问密钥。按提示检查上传、读取或清理权限。开启版本控制时，读取或清理失败还需检查对应的对象版本权限。',
  },
  {
    title: '对话正常，图片生成或上传失败',
    answer: '生图失败时，检查 Key 的生图模型权限和调用明细。若提示「图片已生成，TOS 上传失败」，修复存储配置后在桌面端点击「重试上传」，沿用已生成的原图。',
  },
  {
    title: '桌面端提示未配置或一直排队',
    answer: '确认方舟和 TOS 均已保存。检查 AI 是否暂停，以及「邀请管理」中该用户的 AI 是否已停用。恢复后在桌面端点击「刷新进度」。',
  },
]
</script>

<template>
  <aside id="ai-troubleshooting" class="ops-panel help-faq" aria-labelledby="help-faq-heading">
    <h2 id="help-faq-heading"><AppIcon name="info" :size="18" />常见问题</h2>
    <details v-for="question in questions" :key="question.title">
      <summary>{{ question.title }}<AppIcon name="chevron-down" :size="15" /></summary>
      <p>{{ question.answer }}</p>
    </details>
  </aside>
</template>

<style scoped>
.help-faq { scroll-margin-top: 1rem; }
h2, summary { display: flex; align-items: center; gap: 0.5rem; }
h2 { margin: 0 0 0.65rem; font-size: 1.05rem; }
h2 .app-icon { color: var(--el-color-primary); }
details { border-top: 1px solid var(--color-line); }
summary {
  justify-content: space-between;
  padding: 0.75rem 0;
  list-style: none;
  cursor: pointer;
  font-size: 0.87rem;
  font-weight: 600;
}
summary::-webkit-details-marker { display: none; }
summary:hover { color: var(--el-color-primary); }
details[open] summary .app-icon { transform: rotate(180deg); }
p { margin: 0 0 0.8rem; color: var(--color-muted); font-size: 0.84rem; line-height: 1.65; }
</style>
