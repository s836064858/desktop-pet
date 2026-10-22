<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { readSettings } from '../../lib/capabilities'
import { arkGenerateImage, bytesToDataUrl } from '../../lib/arkClient'
import {
  FRAME_KEYS,
  buildDerivedPrompt,
  buildIdlePrompt,
  draftSpecies,
  generateFramePng,
} from '../../lib/spriteStudio'
import type { SpeciesDraft } from '../../lib/spriteStudio'
import { processSpritePng } from '../../lib/spritePipeline'
import { getCustomSpecies, saveSpeciesToLibrary } from '../../lib/spriteLibrary'
import { builtinSpeciesCodes } from '../../lib/speciesRegistry'
import type { FrameName } from '../../lib/speciesArt'
import styleRefUrl from '../../assets/sprite-ref/style-ref.png'

type FrameStatus = 'pending' | 'running' | 'done' | 'error'

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void, (e: 'saved', code: string): void }>()

const step = ref<'compose' | 'generate' | 'gallery'>('compose')
const phrase = ref('')
const drafting = ref(false)
const hasDraft = ref(false)
const generating = ref(false)
const saving = ref(false)
const regenerating = ref<FrameName | null>(null)

const form = ref({
  code: '',
  name: '',
  emoji: '🌱',
  desc: '',
  states: Object.fromEntries(FRAME_KEYS.map((f) => [f, ''])) as Record<FrameName, string>,
  waterIntervalH: 72,
  sunIntervalH: 120,
})

const frameStatus = ref<Record<FrameName, FrameStatus>>(Object.fromEntries(FRAME_KEYS.map((f) => [f, 'pending'])) as Record<FrameName, FrameStatus>)
const frameUrls = ref<Partial<Record<FrameName, string>>>({})
const frameBytes = ref<Partial<Record<FrameName, Uint8Array>>>({})

const stepIndex = computed(() => (step.value === 'compose' ? 0 : step.value === 'generate' ? 1 : 2))
const hasError = computed(() => FRAME_KEYS.some((f) => frameStatus.value[f] === 'error'))
const allDone = computed(() => FRAME_KEYS.every((f) => frameStatus.value[f] === 'done'))

let styleRefBytes: Uint8Array | null = null

watch(
  () => props.modelValue,
  (open) => {
    if (open) resetWizard()
  },
)

function resetWizard(): void {
  step.value = 'compose'
  phrase.value = ''
  drafting.value = false
  hasDraft.value = false
  generating.value = false
  saving.value = false
  regenerating.value = null
  form.value = {
    code: '',
    name: '',
    emoji: '🌱',
    desc: '',
    states: Object.fromEntries(FRAME_KEYS.map((f) => [f, ''])) as Record<FrameName, string>,
    waterIntervalH: 72,
    sunIntervalH: 120,
  }
  frameStatus.value = Object.fromEntries(FRAME_KEYS.map((f) => [f, 'pending'])) as Record<FrameName, FrameStatus>
  frameUrls.value = {}
  frameBytes.value = {}
}

function onVisibleChange(v: boolean): void {
  emit('update:modelValue', v)
}

async function ensureApiKey(): Promise<string> {
  const { arkApiKey } = await readSettings()
  const key = arkApiKey.trim()
  if (!key) {
    throw new Error('请先到「设置」页配置 AI 素材密钥（ARK_API_KEY）')
  }
  return key
}

async function loadStyleRefBytes(): Promise<Uint8Array> {
  if (!styleRefBytes) {
    styleRefBytes = new Uint8Array(await (await fetch(styleRefUrl)).arrayBuffer())
  }
  return styleRefBytes
}

function applyDraft(d: SpeciesDraft): void {
  form.value.code = d.code
  form.value.name = d.name
  form.value.emoji = d.emoji
  form.value.desc = d.desc
  for (const f of FRAME_KEYS) {
    form.value.states[f] = d.states[f]
  }
  hasDraft.value = true
}

async function startDraft(): Promise<void> {
  if (!phrase.value.trim()) {
    ElMessage.warning('先输入想生成的植物名')
    return
  }
  drafting.value = true
  try {
    const key = await ensureApiKey()
    const d = await draftSpecies(key, phrase.value.trim())
    if (builtinSpeciesCodes().has(d.code)) {
      throw new Error(`code 与内置物种冲突：${d.code}，请换个名字重新起草`)
    }
    if (await getCustomSpecies(d.code)) {
      throw new Error(`本地资源库已存在 "${d.code}"，请换个物种或修改 code`)
    }
    applyDraft(d)
  } catch (err) {
    ElMessage.error(`起草失败：${String(err)}`)
  } finally {
    drafting.value = false
  }
}

function validateForm(): string | null {
  if (!/^[a-z][a-z0-9-]*$/.test(form.value.code)) return 'code 需为英文小写/数字/中划线'
  if (builtinSpeciesCodes().has(form.value.code)) return `code 与内置物种冲突：${form.value.code}`
  if (!form.value.name.trim()) return '名字不能为空'
  if (!form.value.desc.trim()) return '物种描述不能为空'
  for (const f of FRAME_KEYS) {
    if (!form.value.states[f].trim()) return `状态句 ${f} 不能为空`
  }
  if (form.value.waterIntervalH < 6 || form.value.sunIntervalH < 6) return '养护间隔至少 6 小时'
  return null
}

function frameObjectUrl(frame: FrameName, bytes: Uint8Array): string {
  const prev = frameUrls.value[frame]
  if (prev) URL.revokeObjectURL(prev)
  return URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'image/png' }))
}

async function generateOne(frame: FrameName, apiKey: string, idleDataUrl: string | null): Promise<Uint8Array> {
  frameStatus.value[frame] = 'running'
  try {
    const prompt =
      frame === 'idle'
        ? buildIdlePrompt(form.value.desc.trim())
        : buildDerivedPrompt(form.value.desc.trim(), frame, form.value.states[frame].trim())
    const refBytes = frame === 'idle' ? await loadStyleRefBytes() : frameBytes.value.idle
    if (!refBytes) throw new Error('缺少参考图')
    let bytes: Uint8Array
    if (frame === 'idle') {
      bytes = await generateFramePng({ apiKey, prompt, refPngBytes: refBytes })
    } else {
      // 衍生帧：参考本次生成的 idle（dataUrl 形式）
      const refDataUrl = idleDataUrl ?? (await bytesToDataUrl(refBytes))
      bytes = await arkGenerateImage({ apiKey, prompt, refDataUrl })
    }
    frameBytes.value[frame] = bytes
    frameUrls.value[frame] = frameObjectUrl(frame, bytes)
    frameStatus.value[frame] = 'done'
    return bytes
  } catch (err) {
    frameStatus.value[frame] = 'error'
    throw err
  }
}

async function startGenerate(): Promise<void> {
  const invalid = validateForm()
  if (invalid) {
    ElMessage.warning(invalid)
    return
  }
  let apiKey: string
  try {
    apiKey = await ensureApiKey()
  } catch (err) {
    ElMessage.error(String(err))
    return
  }
  step.value = 'generate'
  generating.value = true
  frameStatus.value = Object.fromEntries(FRAME_KEYS.map((f) => [f, 'pending'])) as Record<FrameName, FrameStatus>
  try {
    const idleBytes = await generateOne('idle', apiKey, null)
    const idleDataUrl = await bytesToDataUrl(idleBytes)
    for (const frame of FRAME_KEYS) {
      if (frame === 'idle') continue
      try {
        await generateOne(frame, apiKey, idleDataUrl)
      } catch (err) {
        ElMessage.error(`${frame} 帧生成失败：${String(err)}`)
      }
    }
    const okCount = FRAME_KEYS.filter((f) => frameStatus.value[f] === 'done').length
    ElMessage.success(`生成完成：${okCount}/6 帧${okCount < 6 ? '，失败帧可在下一步重试' : ''}`)
  } finally {
    generating.value = false
  }
}

async function regenerate(frame: FrameName): Promise<void> {
  if (regenerating.value !== null) return
  let apiKey: string
  try {
    apiKey = await ensureApiKey()
  } catch (err) {
    ElMessage.error(String(err))
    return
  }
  regenerating.value = frame
  try {
    const idleDataUrl =
      frame === 'idle' || !frameBytes.value.idle ? null : await bytesToDataUrl(frameBytes.value.idle)
    await generateOne(frame, apiKey, idleDataUrl)
  } catch (err) {
    ElMessage.error(`${frame} 重生成失败：${String(err)}`)
  } finally {
    regenerating.value = null
  }
}

async function saveToLibrary(): Promise<void> {
  if (!allDone.value) {
    ElMessage.warning('还有帧未生成完成（失败的帧请先点「重生成」）')
    return
  }
  const invalid = validateForm()
  if (invalid) {
    ElMessage.warning(invalid)
    return
  }
  saving.value = true
  try {
    const frames: Partial<Record<FrameName, Uint8Array>> = {}
    for (const f of FRAME_KEYS) {
      frames[f] = await processSpritePng(frameBytes.value[f] as Uint8Array)
    }
    await saveSpeciesToLibrary(
      {
        code: form.value.code,
        name: form.value.name.trim(),
        emoji: form.value.emoji.trim() || '🌱',
        desc: form.value.desc.trim(),
        states: { ...form.value.states },
        waterIntervalH: form.value.waterIntervalH,
        sunIntervalH: form.value.sunIntervalH,
      },
      frames,
    )
    ElMessage.success(`"${form.value.name}" 已入库，领养页可以直接领养啦`)
    emit('saved', form.value.code)
    emit('update:modelValue', false)
  } catch (err) {
    ElMessage.error(`入库失败：${String(err)}`)
  } finally {
    saving.value = false
  }
}

function statusTag(status: FrameStatus): 'info' | 'warning' | 'success' | 'danger' {
  if (status === 'done') return 'success'
  if (status === 'running') return 'warning'
  if (status === 'error') return 'danger'
  return 'info'
}

function statusText(status: FrameStatus): string {
  if (status === 'done') return '完成'
  if (status === 'running') return '生成中…'
  if (status === 'error') return '失败'
  return '排队中'
}
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    width="760px"
    append-to-body
    :close-on-click-modal="false"
    @update:model-value="onVisibleChange"
  >
    <template #header>
      <span>✨ AI 生成新物种</span>
    </template>

    <el-steps :active="stepIndex" align-center finish-status="success" class="forge-steps">
      <el-step title="文案与设定" />
      <el-step title="生成 6 帧" />
      <el-step title="确认入库" />
    </el-steps>

    <div v-if="step === 'compose'" class="forge-body">
      <div class="forge-row">
        <el-input
          v-model="phrase"
          placeholder="想生成什么植物？例如：薰衣草"
          @keyup.enter="startDraft"
        />
        <el-button type="primary" :loading="drafting" @click="startDraft">
          {{ hasDraft ? '重新起草' : 'AI 起草文案' }}
        </el-button>
      </div>
      <p class="forge-hint">
        将调用火山方舟生成 6 帧（每帧 1 张），费用很小；密钥在「设置」页配置。入库前可逐帧重生成。
      </p>

      <template v-if="hasDraft">
        <el-divider content-position="left">物种设定（可编辑）</el-divider>
        <div class="forge-grid">
          <label class="forge-field">
            <span>code</span>
            <el-input v-model="form.code" size="small" placeholder="英文小写，如 lavender" />
          </label>
          <label class="forge-field">
            <span>名字</span>
            <el-input v-model="form.name" size="small" maxlength="12" />
          </label>
          <label class="forge-field forge-field-emoji">
            <span>emoji</span>
            <el-input v-model="form.emoji" size="small" maxlength="4" />
          </label>
          <label class="forge-field">
            <span>浇水间隔（小时）</span>
            <el-input-number v-model="form.waterIntervalH" size="small" :min="6" :max="720" :step="24" />
          </label>
          <label class="forge-field">
            <span>晒太阳间隔（小时）</span>
            <el-input-number v-model="form.sunIntervalH" size="small" :min="6" :max="720" :step="24" />
          </label>
        </div>
        <label class="forge-field forge-field-wide">
          <span>物种描述（头顶植物特征）</span>
          <el-input v-model="form.desc" size="small" maxlength="120" />
        </label>
        <div class="forge-states">
          <label v-for="f in FRAME_KEYS" :key="f" class="forge-state">
            <span>{{ f }}</span>
            <el-input v-model="form.states[f]" size="small" maxlength="80" />
          </label>
        </div>
        <div class="forge-actions">
          <el-button type="success" :loading="generating" @click="startGenerate">
            开始生成 6 帧（约 1~3 分钟）
          </el-button>
        </div>
      </template>
    </div>

    <div v-else-if="step === 'generate'" class="forge-body">
      <div v-for="f in FRAME_KEYS" :key="f" class="forge-progress-row">
        <span class="forge-progress-name">{{ f }}</span>
        <el-tag :type="statusTag(frameStatus[f])" size="small">{{ statusText(frameStatus[f]) }}</el-tag>
      </div>
      <p v-if="hasError" class="forge-hint">失败帧可在下一步点击对应图上的「重生成」重试。</p>
      <div class="forge-actions">
        <el-button type="primary" :disabled="generating" @click="step = 'gallery'">
          {{ generating ? '生成中…' : hasError ? '下一步：预览并补齐失败帧' : '下一步：预览确认' }}
        </el-button>
      </div>
    </div>

    <div v-else class="forge-body">
      <div class="forge-gallery">
        <div v-for="f in FRAME_KEYS" :key="f" class="forge-cell">
          <img v-if="frameUrls[f]" :src="frameUrls[f]" alt="" class="forge-thumb" draggable="false" />
          <div v-else class="forge-thumb forge-thumb-empty">{{ statusText(frameStatus[f]) }}</div>
          <div class="forge-cell-foot">
            <span>{{ f }}</span>
            <el-button size="small" :loading="regenerating === f" @click="regenerate(f)">
              {{ frameStatus[f] === 'error' ? '重试' : '重生成' }}
            </el-button>
          </div>
        </div>
      </div>
      <p class="forge-hint">提示：重生成 idle 后，建议把衍生帧也各重生成一次（它们参考的是旧 idle）。</p>
      <div class="forge-actions">
        <el-button type="success" :loading="saving" :disabled="!allDone" @click="saveToLibrary">
          {{ allDone ? '确认入库（抠底 + 存本地资源库）' : '全部帧完成后可入库' }}
        </el-button>
      </div>
    </div>
  </el-dialog>
</template>

<style scoped>
.forge-steps {
  margin-bottom: 14px;
}

.forge-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.forge-row {
  display: flex;
  gap: 10px;
}

.forge-hint {
  margin: 0;
  font-size: 12px;
  color: #909399;
}

.forge-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 14px;
}

.forge-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: #606266;
}

.forge-field-emoji :deep(input) {
  width: 64px;
  text-align: center;
}

.forge-field-wide {
  width: 100%;
}

.forge-states {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px 14px;
}

.forge-state {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #606266;
}

.forge-state > span {
  width: 52px;
  flex-shrink: 0;
  text-align: right;
}

.forge-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 4px;
}

.forge-progress-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  border-radius: 8px;
  background: #f5f7fa;
}

.forge-progress-name {
  font-size: 13px;
  font-weight: 600;
}

.forge-gallery {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.forge-cell {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px;
  border: 1px solid #ebeef5;
  border-radius: 10px;
  background: #fff;
}

.forge-thumb {
  width: 100%;
  aspect-ratio: 1;
  object-fit: contain;
  background:
    conic-gradient(#f5f7fa 25%, #fff 0 50%, #f5f7fa 0 75%, #fff 0) 0 0 / 16px 16px;
  border-radius: 8px;
}

.forge-thumb-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: #909399;
}

.forge-cell-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  color: #606266;
}
</style>
