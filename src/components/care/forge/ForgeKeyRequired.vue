<script setup lang="ts">
import AppIcon from '../../common/AppIcon.vue'

defineProps<{ isLoading: boolean; hasReadError: boolean }>()
defineEmits<{ configure: []; 'show-guide': [] }>()
</script>

<template>
  <section class="key-required" aria-label="AI 密钥配置提示" :aria-busy="isLoading">
    <div class="key-required-content" role="status">
      <span class="key-required-icon"
        ><AppIcon :name="hasReadError ? 'info' : 'key'" :size="30"
      /></span>
      <h3 class="key-required-title">
        {{
          isLoading
            ? '正在读取 AI 配置'
            : hasReadError
              ? '暂时无法读取 AI 配置'
              : '先配置密钥，再聊聊你的植物'
        }}
      </h3>
      <p class="key-required-description">
        {{
          isLoading
            ? '请稍候，正在检查本机保存的密钥。'
            : hasReadError
              ? '请打开密钥设置重新读取，已有对话和植物方案会保留。'
              : '植物识别、对话规划和形象生成需要火山方舟 API Key。'
        }}<br v-if="!isLoading && !hasReadError" /><span
          v-if="!isLoading && !hasReadError"
          >配置完成后，就可以从一张照片或一个想法开始。</span
        >
      </p>
      <div v-if="!isLoading" class="key-required-actions">
        <el-button class="configure-key" type="primary" @click="$emit('configure')"
          ><AppIcon name="key" :size="16" />{{
            hasReadError ? '检查密钥配置' : '配置密钥'
          }}</el-button
        >
        <el-button text @click="$emit('show-guide')"
          >查看获取教程<AppIcon name="arrow-right" :size="15"
        /></el-button>
      </div>
      <p v-if="!isLoading" class="key-required-hint">
        之后可以随时从右上角查看或修改密钥。
      </p>
    </div>
  </section>
</template>

<style scoped>
.key-required {
  display: flex;
  flex: 1;
  min-height: 0;
  align-items: center;
  justify-content: center;
  overflow-y: auto;
  padding: 32px 18px;
  text-align: center;
}
.key-required-content {
  max-width: 440px;
  margin: auto;
}
.key-required-icon {
  display: inline-grid;
  place-items: center;
  width: 68px;
  height: 68px;
  margin-bottom: 20px;
  border-radius: 50%;
  background: #edf1e5;
  color: #789267;
}
.key-required-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #456746;
}
.key-required-description {
  margin: 14px 0 22px;
  color: #839078;
  font-size: 12px;
  line-height: 2;
}
.key-required-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 10px;
}
.key-required-actions :deep(.el-button) {
  margin-left: 0;
}
.key-required-actions :deep(.el-button > span) {
  gap: 7px;
}
.configure-key {
  --el-button-bg-color: #3f6241;
  --el-button-border-color: #3f6241;
  --el-button-hover-bg-color: #527851;
  --el-button-hover-border-color: #527851;
  --el-button-active-bg-color: #345437;
  --el-button-active-border-color: #345437;
}
.key-required-hint {
  margin: 18px 0 0;
  color: #a0a994;
  font-size: 10px;
  line-height: 1.7;
}
@media (max-height: 700px) {
  .key-required {
    padding: 20px 12px;
  }
  .key-required-icon {
    width: 52px;
    height: 52px;
    margin-bottom: 14px;
  }
}
</style>
