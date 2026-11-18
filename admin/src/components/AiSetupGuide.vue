<script setup lang="ts">
import { RouterLink } from 'vue-router'
import AppIcon from '../../../src/components/common/AppIcon.vue'
</script>

<template>
  <ol class="setup-steps" aria-label="配置步骤">
    <li id="ark-setup" class="ops-panel">
      <h2><AppIcon name="sparkles" :size="19" />开通火山方舟</h2>
      <p>在方舟控制台开通下面两个模型，并在同一个资源项目中创建有权调用它们的 API Key。</p>
      <dl class="setup-values">
        <dt>对话模型</dt><dd><code>doubao-seed-2-1-lite-260915</code></dd>
        <dt>生图模型</dt><dd><code>doubao-seedream-5-0-flash-260915</code></dd>
      </dl>
      <p>将完整 Key 填入「方舟 API Key」，点击「验证并保存」。验证会调用一次对话模型，可能产生少量 Token 费用。生图权限可用桌面端生成主形象来确认。</p>
      <div class="setup-links">
        <a href="https://docs.volcengine.com/docs/ark/quick-start?lang=zh" target="_blank" rel="noopener noreferrer">方舟快速入门<AppIcon name="external" :size="13" /></a>
        <a href="https://console.volcengine.com/ark/region%3Acn-beijing/docs/manage-api-keys" target="_blank" rel="noopener noreferrer">管理 API Key<AppIcon name="external" :size="13" /></a>
      </div>
    </li>
    <li id="tos-setup" class="ops-panel">
      <h2><AppIcon name="image" :size="19" />配置 TOS 素材存储</h2>
      <p>在对象存储控制台创建私有桶，为服务使用的 IAM 用户授权，然后在后台填写下面四项。</p>
      <dl class="setup-values">
        <dt>存储桶名称</dt><dd>桶列表中的名称</dd>
        <dt>地域 ID</dt><dd>桶所在地域的 ID，例如 <code>cn-beijing</code></dd>
        <dt>AccessKey ID</dt><dd>从 IAM「API 访问密钥」获取</dd>
        <dt>AccessKey Secret</dt><dd>与 ID 配对的访问密钥</dd>
      </dl>
      <p>授权范围可限定在目标桶的 <code>sproutkin/checks/*</code> 和 <code>sproutkin/generated/*</code> 前缀，授予对象上传、读取和删除权限。启用版本控制的桶还需要读取和删除对象版本的权限。</p>
      <p>点击「验证并保存」后，系统会上传测试图片、下载核对并清理。验证失败时继续使用原配置。</p>
      <div class="setup-links">
        <a href="https://docs.volcengine.com/docs/torch-object-storage/creating-buckets?lang=zh" target="_blank" rel="noopener noreferrer">创建私有桶<AppIcon name="external" :size="13" /></a>
        <a href="https://docs.volcengine.com/docs/iam/api-access-key-management?lang=zh" target="_blank" rel="noopener noreferrer">获取访问密钥<AppIcon name="external" :size="13" /></a>
        <a href="https://docs.volcengine.com/docs/torch-object-storage/overview-of-rights-management?lang=zh" target="_blank" rel="noopener noreferrer">配置桶权限<AppIcon name="external" :size="13" /></a>
      </div>
    </li>
    <li id="desktop-check" class="ops-panel">
      <h2><AppIcon name="check" :size="19" />从桌面端验证</h2>
      <p>确认方舟和 TOS 均为「已配置」，AI 运行状态为「允许派发」。</p>
      <p>在「邀请管理」生成邀请码。在桌面端领养页打开「AI 创建植物」，填写昵称和邀请码。输入植物名，例如「栀子花」，收到方案后点击「按此方案生成主形象」，确认图片能正常显示。</p>
      <div class="setup-links">
        <RouterLink :to="{ name: 'invites' }">打开邀请管理<AppIcon name="arrow-right" :size="14" /></RouterLink>
        <RouterLink :to="{ name: 'usage' }">查看任务与用量<AppIcon name="arrow-right" :size="14" /></RouterLink>
      </div>
    </li>
  </ol>
</template>

<style scoped>
.setup-steps { margin: 0; padding: 0; list-style-position: inside; }
.setup-steps li { scroll-margin-top: 1rem; }
.setup-steps li::marker { color: var(--el-color-primary); font-weight: 700; }
h2 {
  display: inline-flex;
  align-items: center;
  vertical-align: baseline;
  gap: 0.45rem;
  margin: 0 0 0 0.2rem;
  font-size: 1.05rem;
}
h2 .app-icon { align-self: center; color: var(--el-color-primary); }
p, .setup-values { margin: 0.65rem 0; font-size: 0.88rem; line-height: 1.7; }
p { color: var(--color-muted); }
.setup-values {
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  gap: 0.35rem 0.9rem;
  padding: 0.6rem 0.75rem;
  border-radius: 6px;
  background: var(--color-subtle);
}
.setup-values dt { font-weight: 600; }
.setup-values dd { min-width: 0; margin: 0; }
code { overflow-wrap: anywhere; }
.setup-links { display: flex; flex-wrap: wrap; gap: 0.4rem 1rem; margin-top: 0.8rem; }
.setup-links a { display: inline-flex; align-items: center; gap: 0.3rem; color: var(--el-color-primary-dark-2); font-size: 0.84rem; }
@media (max-width: 430px) {
  .setup-values { grid-template-columns: minmax(0, 1fr); gap: 0.15rem; }
  .setup-values dd + dt { margin-top: 0.35rem; }
}
</style>
