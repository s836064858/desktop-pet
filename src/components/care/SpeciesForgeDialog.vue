<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { ElMessage } from 'element-plus'
import { useSpeciesForge } from '../../composables/useSpeciesForge'
import type { ForgeForm } from './forge/types'
import ForgeApiKey from './forge/ForgeApiKey.vue'
import ForgeCompose from './forge/ForgeCompose.vue'
import ForgeProgress from './forge/ForgeProgress.vue'
import ForgeGallery from './forge/ForgeGallery.vue'
import ForgeGuide from './forge/ForgeGuide.vue'
import AppIcon from '../common/AppIcon.vue'

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean]; saved: [code: string] }>()
const hasKey = shallowRef(false)
const isKeyBusy = shallowRef(true)
// null = 跟随默认（未配置密钥时显示引导页），true/false = 用户手动开关
const showGuide = shallowRef<boolean | null>(null)
const {
  form,
  step,
  phrase,
  hasDraft,
  isDrafting,
  isGenerating,
  isSaving,
  regeneratingFrame,
  errorMessage,
  frameStatus,
  frameUrls,
  isBusy: isForgeBusy,
  doneCount,
  allDone,
  hasError,
  startDraft,
  startGenerate,
  regenerate,
  saveToLibrary,
  returnToCompose,
} = useSpeciesForge({ onSaved })
const stepIndex = computed(() => (step.value === 'compose' ? 0 : step.value === 'generate' ? 1 : 2))
const isBusy = computed(() => isForgeBusy.value || isKeyBusy.value)
const guideVisible = computed(
  () => step.value === 'compose' && (showGuide.value ?? (!hasKey.value && !isKeyBusy.value)),
)

function onSaved(code: string): void {
  emit('saved', code)
  emit('update:modelValue', false)
}
function updateForm(next: ForgeForm): void {
  Object.assign(form, next)
}
function onKeyStatus(status: { hasKey: boolean; isBusy: boolean }): void {
  hasKey.value = status.hasKey
  isKeyBusy.value = status.isBusy
  if (status.hasKey) showGuide.value = null
}
function openGuide(): void {
  showGuide.value = true
}
function closeGuide(): void {
  showGuide.value = false
}
function requestClose(done: () => void): void {
  if (isBusy.value) {
    ElMessage.info('正在处理，请完成后再关闭。')
    return
  }
  done()
}
function onVisibleChange(value: boolean): void {
  if (!value && isBusy.value) return
  emit('update:modelValue', value)
}
function showGallery(): void {
  if (!isBusy.value) step.value = 'gallery'
}
</script>

<template>
  <el-dialog
    :model-value="props.modelValue"
    class="species-forge"
    width="min(640px, calc(100vw - 40px))"
    align-center
    append-to-body
    :close-on-click-modal="false"
    :close-on-press-escape="!isBusy"
    :show-close="!isBusy"
    :before-close="requestClose"
    @update:model-value="onVisibleChange"
  >
    <template #header
      ><div class="forge-title">
        <AppIcon name="sparkles" :size="20" /><span>AI 生成新物种</span>
      </div></template
    >
    <nav v-if="!guideVisible" class="forge-steps" aria-label="生成步骤">
      <div
        v-for="(title, index) in ['描述植物', '生成形象', '确认入库']"
        :key="title"
        class="forge-step"
        :class="{ 'is-active': index <= stepIndex }"
        :aria-current="index === stepIndex ? 'step' : undefined"
      >
        <span class="step-number"
          ><AppIcon v-if="index < stepIndex" name="check" :size="14" /><template v-else>{{
            index + 1
          }}</template></span
        ><span>{{ title }}</span>
      </div>
    </nav>
    <div class="forge-body">
      <ForgeApiKey :is-disabled="isForgeBusy" @status="onKeyStatus" @show-guide="openGuide" />
      <ForgeGuide v-if="guideVisible" @done="closeGuide" />
      <ForgeCompose
        v-else-if="step === 'compose'"
        :form="form"
        v-model:phrase="phrase"
        :has-draft="hasDraft"
        :is-drafting="isDrafting"
        :is-disabled="isBusy"
        :has-key="hasKey"
        @update:form="updateForm"
        @draft="startDraft"
      />
      <ForgeProgress
        v-else-if="step === 'generate'"
        :name="form.name"
        :frame-status="frameStatus"
        :preview-url="frameUrls.idle"
        :done-count="doneCount"
        :is-generating="isGenerating"
      />
      <ForgeGallery
        v-else
        :frame-urls="frameUrls"
        :frame-status="frameStatus"
        :regenerating-frame="regeneratingFrame"
        :is-disabled="isBusy"
        @regenerate="regenerate"
      />
    </div>
    <template #footer>
      <p v-if="errorMessage" class="inline-note error-note forge-error" role="alert">
        {{ errorMessage }}
      </p>
      <div class="forge-footer">
        <span v-if="guideVisible" class="footer-status"
          ><AppIcon name="key" :size="15" />按上方引导配置密钥</span
        >
        <span v-else-if="step === 'compose'" class="footer-status"
          ><AppIcon name="key" :size="15" />{{ hasKey ? '密钥已配置' : '请先配置密钥' }}</span
        >
        <span v-else-if="step === 'generate' && isGenerating" class="footer-status"
          >图片由火山方舟生成</span
        >
        <el-button v-else :disabled="isBusy" @click="returnToCompose">返回调整</el-button>
        <el-button
          v-if="step === 'compose'"
          type="primary"
          :disabled="!hasDraft || !hasKey || isBusy"
          @click="startGenerate"
          >开始生成</el-button
        >
        <el-button
          v-else-if="step === 'generate'"
          type="primary"
          :loading="isGenerating"
          :disabled="isBusy"
          @click="showGallery"
          >{{ isGenerating ? '生成中…' : hasError ? '预览并重试' : '预览确认' }}</el-button
        >
        <el-button
          v-else
          type="primary"
          :loading="isSaving"
          :disabled="!allDone || isBusy"
          @click="saveToLibrary"
          >{{ allDone ? '确认入库' : '请先补齐六帧' }}</el-button
        >
      </div>
    </template>
  </el-dialog>
</template>

<style scoped>
.forge-title {
  display: flex;
  align-items: center;
  gap: 9px;
  font-size: 16px;
  font-weight: 650;
}
.forge-steps {
  display: flex;
  gap: 16px;
  padding: 14px 0 22px;
}
.forge-step {
  display: flex;
  align-items: center;
  flex: 1;
  gap: 8px;
  color: #a1a799;
  font-size: 12px;
  white-space: nowrap;
}
.forge-step:not(:last-child)::after {
  content: '';
  flex: 1;
  height: 1px;
  background: #dce0d2;
  margin-left: 8px;
}
.forge-step.is-active {
  color: #366547;
  font-weight: 600;
}
.step-number {
  display: grid;
  place-items: center;
  width: 25px;
  height: 25px;
  border-radius: 50%;
  background: #dce0d4;
  color: #fff;
  font-size: 12px;
  flex-shrink: 0;
}
.is-active .step-number {
  background: #3b6f50;
}
.forge-body {
  padding: 0 2px 4px;
}
.forge-error {
  margin: 0 0 12px;
  text-align: left;
}
.forge-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}
.footer-status {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-size: 11px;
  color: #84917b;
}
.forge-footer > .el-button--primary {
  min-width: 120px;
}
.forge-footer :deep(.el-button) {
  margin-left: 0;
}
</style>

<style>
.species-forge {
  padding: 22px 24px 18px;
  display: flex;
  flex-direction: column;
  max-height: calc(100vh - 40px);
}
.species-forge .el-dialog__header {
  padding-bottom: 14px;
  border-bottom: 1px solid var(--sprout-line);
  margin-right: 0;
  flex-shrink: 0;
}
.species-forge .el-dialog__headerbtn {
  top: 15px;
  right: 14px;
}
.species-forge .el-dialog__body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding-right: 3px;
}
.species-forge .el-dialog__footer {
  margin-top: 18px;
  padding-top: 16px;
  border-top: 1px solid var(--sprout-line);
  flex-shrink: 0;
}
@media (max-width: 500px) {
  .species-forge {
    padding: 18px;
  }
  .species-forge .forge-steps {
    gap: 7px;
  }
  .species-forge .forge-step {
    gap: 5px;
    font-size: 11px;
  }
}
</style>
