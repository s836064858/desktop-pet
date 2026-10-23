<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { openExternalUrl } from '../../../lib/capabilities'
import AppIcon from '../../common/AppIcon.vue'

interface GuideStep {
  title: string
  desc: string
  url?: string
  linkLabel?: string
}

const guideSteps: GuideStep[] = [
  {
    title: '注册火山引擎账号',
    desc: '在火山引擎官网注册账号，并完成实名认证（个人即可），开通模型服务前必填。',
    url: 'https://www.volcengine.com',
    linkLabel: '打开火山引擎官网',
  },
  {
    title: '开通模型服务',
    desc: '进入火山方舟控制台，在左侧「开通管理」中开通本应用用到的两个模型：生图 Doubao-Seedream-5.0-flash、文案 Doubao-Seed-2.1-lite。模型按用量计费，账户需有余额或代金券。',
    url: 'https://console.volcengine.com/ark',
    linkLabel: '打开方舟控制台',
  },
  {
    title: '创建 API Key',
    desc: '在控制台左侧「API Key 管理」点击「创建 API Key」，复制生成的密钥。密钥只展示一次，请妥善保存。',
    url: 'https://console.volcengine.com/ark/apiKey',
    linkLabel: '前往 API Key 管理',
  },
  {
    title: '回到本页粘贴密钥',
    desc: '在上方「AI 素材密钥」卡片粘贴密钥并保存，保存后即可开始 AI 起草与生图。',
  },
]

const emit = defineEmits<{ done: [] }>()

async function openLink(url: string): Promise<void> {
  try {
    await openExternalUrl(url)
  } catch {
    ElMessage.info('打开浏览器失败，请手动访问：' + url)
  }
}
</script>
<template>
  <section class="forge-guide" aria-label="火山方舟开通引导">
    <h3 class="guide-title">接入火山方舟，开启 AI 生成</h3>
    <p class="guide-intro">首次使用需要一把火山方舟 API Key，按下面四步获取，全程约五分钟。</p>
    <ol class="guide-steps">
      <li v-for="(item, index) in guideSteps" :key="item.title" class="guide-step">
        <span class="guide-number" aria-hidden="true">{{ index + 1 }}</span>
        <div class="step-body">
          <h4 class="step-title">{{ item.title }}</h4>
          <p class="step-desc">{{ item.desc }}</p>
          <el-button v-if="item.url" class="step-link" text size="small" @click="openLink(item.url)">
            <AppIcon name="external" :size="14" />{{ item.linkLabel }}
          </el-button>
        </div>
      </li>
    </ol>
    <div class="guide-foot">
      <p class="guide-note"><AppIcon name="info" :size="14" /> 密钥只保存在本机设置中，仅用于调用你自己的方舟账户。</p>
      <el-button size="small" aria-label="完成引导，返回生成" @click="emit('done')">我已拿到密钥</el-button>
    </div>
  </section>
</template>
<style scoped>
.forge-guide {
  border: 1px solid #dfe4d4;
  border-radius: 12px;
  background: #f6f8f0;
  padding: 18px 18px 14px;
}
.guide-title {
  margin: 0;
  font-size: 18px;
  font-weight: 650;
  color: #366547;
}
.guide-intro {
  margin: 8px 0 16px;
  font-size: 12px;
  color: #84917b;
}
.guide-steps {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.guide-step {
  display: flex;
  gap: 11px;
}
.guide-number {
  display: grid;
  place-items: center;
  width: 25px;
  height: 25px;
  border-radius: 50%;
  background: #e2e8d6;
  color: #526e4f;
  font-size: 12px;
  font-weight: 600;
  flex-shrink: 0;
  margin-top: 1px;
}
.step-body {
  min-width: 0;
}
.step-title {
  margin: 2px 0 4px;
  font-size: 13px;
  font-weight: 600;
  color: #47573f;
}
.step-desc {
  margin: 0;
  font-size: 11px;
  line-height: 1.7;
  color: #79856c;
}
.step-link {
  margin-top: 3px;
  font-size: 11px;
  color: #3c694e;
}
.step-link :deep(.app-icon) {
  margin-right: 4px;
}
.guide-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px dashed #dfe4d4;
}
.guide-note {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  font-size: 11px;
  color: #8a927e;
}
</style>
