<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { ElMessage, ElMessageBox } from 'element-plus'
import { isAutostartOn, readSettings, saveSettings, setAutostart, setPetClickThrough } from '../../lib/capabilities'
import type { AppSettings } from '../../lib/capabilities'
import { useCareStore } from '../../stores/care'

const careStore = useCareStore()
const { plant } = storeToRefs(careStore)

const settings = ref<AppSettings>({
  quietEnabled: false,
  quietStart: '22:00',
  quietEnd: '08:00',
  pausedUntil: null,
  arkApiKey: '',
})
const isClickThrough = ref(false)
const isAutostart = ref(false)
const arkKeyInput = ref('')

async function saveArkKey(): Promise<void> {
  try {
    settings.value = await saveSettings({ arkApiKey: arkKeyInput.value.trim() })
    ElMessage.success('AI 素材密钥已保存')
  } catch (err) {
    ElMessage.error(`保存密钥失败：${String(err)}`)
  }
}

async function patchSettings(patch: Partial<AppSettings>): Promise<void> {
  try {
    settings.value = await saveSettings(patch)
  } catch (err) {
    ElMessage.error(`保存设置失败：${String(err)}`)
  }
}

const onChangeQuiet = (value: string | number | boolean) => {
  void patchSettings({ quietEnabled: Boolean(value) })
}

const onChangeQuietStart = (value: string) => {
  void patchSettings({ quietStart: value })
}

const onChangeQuietEnd = (value: string) => {
  void patchSettings({ quietEnd: value })
}

const onChangeClickThrough = (value: string | number | boolean) => {
  setPetClickThrough(Boolean(value))
    .then(() => {
      isClickThrough.value = Boolean(value)
    })
    .catch((err: unknown) => {
      ElMessage.error(`切换穿透失败：${String(err)}`)
    })
}

const onChangeAutostart = (value: string | number | boolean) => {
  setAutostart(Boolean(value))
    .then(() => {
      isAutostart.value = Boolean(value)
      ElMessage.success(Boolean(value) ? '已写入系统启动项' : '已移出系统启动项')
    })
    .catch((err: unknown) => {
      ElMessage.error(`切换自启失败：${String(err)}`)
    })
}

async function confirmReset(): Promise<void> {
  try {
    await ElMessageBox.confirm(
      '将删除当前植物与它的全部任务（积分保留），桌面分身会离开。确定重新领养吗？',
      '重新领养',
      { type: 'warning', confirmButtonText: '确定', cancelButtonText: '再想想' },
    )
  } catch {
    return
  }
  try {
    await careStore.resetAdopted()
    ElMessage.success('已送别，可以重新领养了')
  } catch (err) {
    ElMessage.error(`重置失败：${String(err)}`)
  }
}

onMounted(async () => {
  try {
    settings.value = await readSettings()
    arkKeyInput.value = settings.value.arkApiKey
    isClickThrough.value = false
    isAutostart.value = await isAutostartOn()
  } catch (err) {
    ElMessage.error(`设置加载失败：${String(err)}`)
  }
})
</script>

<template>
  <section class="settings">
    <h3 class="settings-title">设置</h3>
    <div class="settings-grid">
      <div class="settings-item">
        <span class="settings-label">免打扰时段（提醒静默，互动照常）</span>
        <div class="settings-inline">
          <el-switch :model-value="settings.quietEnabled" @change="onChangeQuiet" />
          <el-time-select
            class="settings-time"
            :model-value="settings.quietStart"
            :disabled="!settings.quietEnabled"
            start="00:00"
            end="23:45"
            step="00:15"
            @update:model-value="onChangeQuietStart"
          />
          <span>至</span>
          <el-time-select
            class="settings-time"
            :model-value="settings.quietEnd"
            :disabled="!settings.quietEnabled"
            start="00:00"
            end="23:45"
            step="00:15"
            @update:model-value="onChangeQuietEnd"
          />
        </div>
      </div>
      <div class="settings-item">
        <span class="settings-label">宠物窗鼠标穿透（鼠标穿过宠物）</span>
        <el-switch :model-value="isClickThrough" @change="onChangeClickThrough" />
      </div>
      <div class="settings-item">
        <span class="settings-label">开机自启</span>
        <el-switch :model-value="isAutostart" @change="onChangeAutostart" />
      </div>
      <div class="settings-item">
        <span class="settings-label">
          AI 素材密钥（火山方舟）
          <span class="settings-hint">用于 AI 生成新物种；获取：console.volcengine.com/ark</span>
        </span>
        <div class="settings-inline">
          <el-input
            v-model="arkKeyInput"
            type="password"
            show-password
            size="small"
            placeholder="ARK_API_KEY"
            class="settings-key"
          />
          <el-button size="small" @click="saveArkKey">保存</el-button>
        </div>
      </div>
      <div class="settings-item">
        <span class="settings-label">送别当前植物，重新领养</span>
        <el-button size="small" type="danger" plain :disabled="!plant" @click="confirmReset">
          重新领养
        </el-button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.settings {
  margin-top: 16px;
}

.settings-title {
  margin: 0 0 10px;
  font-size: 14px;
  color: #606266;
}

.settings-grid {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.settings-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.settings-label {
  font-size: 13px;
  color: #303133;
}

.settings-inline {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #606266;
}

.settings-time {
  width: 110px;
}

.settings-key {
  width: 220px;
}

.settings-hint {
  display: block;
  font-size: 11px;
  color: #909399;
}
</style>
