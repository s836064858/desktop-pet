<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { ElMessage } from 'element-plus'
import { useSpeciesForge } from '../../composables/useSpeciesForge'
import ForgeApiKey from './forge/ForgeApiKey.vue'
import ForgeCompose from './forge/ForgeCompose.vue'
import ForgeProgress from './forge/ForgeProgress.vue'
import ForgeGallery from './forge/ForgeGallery.vue'
import ForgeKeyRequired from './forge/ForgeKeyRequired.vue'
import ForgeBases from './forge/ForgeBases.vue'
import { FRAME_KEYS, GROWTH_STAGE_KEYS } from '../../lib/spriteFrames'
import AppIcon from '../common/AppIcon.vue'

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  saved: [code: string]
}>()
const hasKey = shallowRef(false)
const isKeyBusy = shallowRef(true)
const hasKeyReadError = shallowRef(false)
const isKeyEditorOpen = shallowRef(false)
const isKeyGuideOpen = shallowRef(false)
const {
  form,
  step,
  phrase,
  hasDraft,
  isDrafting,
  isReadingReference,
  referencePreviewUrl,
  referenceFileName,
  referenceDimensions,
  referenceMessage,
  uploadReference,
  removeReference,
  isGenerating,
  isSaving,
  regeneratingTarget,
  errorMessage,
  frameStatus,
  frameUrls,
  isBusy: isForgeBusy,
  doneCount,
  isAllDone,
  isCancelling,
  confirmedBases,
  hasConfirmedBases,
  frameErrors,
  checkedCount,
  canGenerate,
  chatMessages,
  planMessageId,
  canSendPlanning,
  canRetryPlanning,
  retryDraft,
  startDraft,
  startGenerate,
  regenerate,
  saveToLibrary,
  confirmBase,
  startDerived,
  cancelOperation,
  goToStep,
} = useSpeciesForge({ onSaved })
const stepTitles = ['对话规划', '确认主形象', '生成状态', '确认入库']
const stepIndex = computed(() =>
  ['compose', 'bases', 'generate', 'gallery'].indexOf(step.value),
)
const previewUrl = computed(() => {
  const stage =
    GROWTH_STAGE_KEYS.find((item) =>
      FRAME_KEYS.some(
        (frame) =>
          frameStatus[item][frame] === 'running' ||
          frameStatus[item][frame] === 'checking',
      ),
    ) ?? 'juvenile'
  return frameUrls[stage].idle
})
const isBusy = computed(() => isForgeBusy.value || isKeyBusy.value)

function onSaved(code: string): void {
  emit('saved', code)
  emit('update:modelValue', false)
}
function onKeyStatus(status: {
  hasKey: boolean
  isBusy: boolean
  hasReadError: boolean
}): void {
  hasKey.value = status.hasKey
  isKeyBusy.value = status.isBusy
  hasKeyReadError.value = status.hasReadError
}
function requestClose(done: () => void): void {
  if (isBusy.value) {
    ElMessage.info(
      isSaving.value
        ? '正在入库，请完成后再关闭。'
        : '正在处理，请先停止当前操作再关闭。',
    )
    return
  }
  done()
}
function onVisibleChange(value: boolean): void {
  if (!value && isBusy.value) return
  emit('update:modelValue', value)
}
</script>

<template>
  <el-dialog
    :model-value="props.modelValue"
    class="species-forge"
    :class="{ 'is-conversation': step === 'compose' }"
    width="min(780px, calc(100vw - 40px))"
    align-center
    append-to-body
    :close-on-click-modal="false"
    :close-on-press-escape="!isBusy"
    :show-close="!isBusy"
    :before-close="requestClose"
    @update:model-value="onVisibleChange"
  >
    <template #header>
      <div class="forge-heading">
        <div class="forge-title">
          <AppIcon name="leaf" :size="25" /><span>AI 创建植物</span>
        </div>
        <ForgeApiKey
          v-model:is-open="isKeyEditorOpen"
          v-model:is-guide-open="isKeyGuideOpen"
          :is-disabled="isForgeBusy"
          @status="onKeyStatus"
        />
      </div>
      <p v-if="step === 'compose'" class="forge-subtitle">
        聊聊你的植物，一起创造它的数字分身
      </p>
      <nav class="forge-steps" aria-label="生成步骤">
        <div
          v-for="(title, index) in stepTitles"
          :key="title"
          class="forge-step"
          :class="{ 'is-active': index <= stepIndex }"
          :aria-current="index === stepIndex ? 'step' : undefined"
        >
          <span class="step-number"
            ><AppIcon v-if="index < stepIndex" name="check" :size="14" /><template
              v-else
              >{{ index + 1 }}</template
            ></span
          ><span>{{ title }}</span>
        </div>
      </nav>
    </template>
    <div class="forge-body">
      <ForgeKeyRequired
        v-if="step === 'compose' && !hasKey"
        :is-loading="isKeyBusy"
        :has-read-error="hasKeyReadError"
        @configure="isKeyEditorOpen = true"
        @show-guide="isKeyGuideOpen = true"
      />
      <ForgeCompose
        v-else-if="step === 'compose'"
        :form="form"
        v-model:phrase="phrase"
        :has-draft="hasDraft"
        :plan-message-id="planMessageId"
        :can-generate="canGenerate"
        :is-cancelling="isCancelling"
        :error-message="errorMessage"
        :chat-messages="chatMessages"
        :can-send="canSendPlanning"
        :can-retry="canRetryPlanning"
        :is-drafting="isDrafting"
        :is-disabled="isBusy"
        :has-key="hasKey"
        :reference-preview-url="referencePreviewUrl"
        :reference-file-name="referenceFileName"
        :reference-dimensions="referenceDimensions"
        :reference-message="referenceMessage"
        :is-reading-reference="isReadingReference"
        @draft="startDraft"
        @retry="retryDraft"
        @generate="startGenerate"
        @cancel="cancelOperation"
        @select-reference="uploadReference"
        @remove-reference="removeReference"
      />
      <ForgeBases
        v-else-if="step === 'bases'"
        :frame-urls="frameUrls"
        :frame-status="frameStatus"
        :confirmed-bases="confirmedBases"
        :frame-errors="frameErrors"
        :is-disabled="isBusy"
        @confirm="confirmBase"
        @regenerate="regenerate"
      />
      <ForgeProgress
        v-else-if="step === 'generate'"
        :name="form.name"
        :frame-status="frameStatus"
        :preview-url="previewUrl"
        :done-count="doneCount"
        :is-generating="isGenerating"
      />
      <ForgeGallery
        v-else
        :frame-urls="frameUrls"
        :frame-status="frameStatus"
        :regenerating-target="regeneratingTarget"
        :frame-errors="frameErrors"
        :checked-count="checkedCount"
        :is-disabled="isBusy"
        @regenerate="regenerate"
      />
    </div>
    <template v-if="step !== 'compose'" #footer>
      <p v-if="errorMessage" class="inline-note error-note forge-error" role="alert">
        {{ errorMessage }}
      </p>
      <div class="forge-footer">
        <el-button
          v-if="isForgeBusy && !isSaving"
          :loading="isCancelling"
          :disabled="isCancelling"
          @click="cancelOperation"
          >{{
            isReadingReference ? '停止读取' : isDrafting ? '停止对话' : '停止生成'
          }}</el-button
        >
        <el-button v-else :disabled="isBusy" @click="goToStep('compose')"
          >返回调整</el-button
        >
        <el-button
          v-if="step === 'bases'"
          type="primary"
          :loading="isGenerating"
          :disabled="!hasConfirmedBases || isBusy"
          @click="startDerived"
          >{{ hasConfirmedBases ? '生成互动状态' : '请确认三个形象' }}</el-button
        >
        <el-button v-else-if="step === 'generate' && !isBusy" @click="startDerived"
          >继续补齐</el-button
        >
        <el-button
          v-if="step === 'generate'"
          type="primary"
          :loading="isGenerating"
          :disabled="isBusy"
          @click="goToStep('gallery')"
          >{{ isGenerating ? '生成中…' : '预览并重试' }}</el-button
        >
        <el-button
          v-if="step === 'gallery' && doneCount < 18"
          :disabled="isBusy"
          @click="startDerived"
          >补齐缺失状态</el-button
        >
        <el-button
          v-if="step === 'gallery'"
          type="primary"
          :loading="isSaving"
          :disabled="!isAllDone || isBusy"
          @click="saveToLibrary"
          >{{
            isAllDone
              ? '确认入库'
              : doneCount < 18
                ? '请先补齐18帧'
                : `检查通过 ${checkedCount}/18 帧`
          }}</el-button
        >
      </div>
    </template>
  </el-dialog>
</template>

<style scoped>
.forge-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding-right: 32px;
}
.forge-title {
  display: flex;
  align-items: center;
  gap: 9px;
  font-size: 20px;
  font-weight: 650;
}
.forge-subtitle {
  margin: 7px 0 0 34px;
  color: #8a9580;
  font-size: 11px;
  line-height: 1.7;
}
.forge-steps {
  display: flex;
  gap: 16px;
  padding: 22px 0 4px;
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
  white-space: pre-line; /* 指引 + 「详情」两段式报错换行展示 */
}
.forge-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
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
.species-forge.is-conversation {
  height: min(860px, calc(100vh - 40px));
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
.species-forge.is-conversation .el-dialog__body {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding-top: 8px;
  padding-bottom: 0;
}
.species-forge.is-conversation .forge-body {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  padding-bottom: 0;
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
    font-size: 10px;
  }
  .species-forge .step-number {
    width: 20px;
    height: 20px;
  }
  .species-forge .forge-step:not(:last-child)::after {
    display: none;
  }
}
</style>
