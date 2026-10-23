import { computed, onUnmounted, reactive, shallowReactive, shallowRef } from 'vue'
import { ElMessage } from 'element-plus'
import { readSettings } from '../lib/capabilities'
import {
  FRAME_KEYS,
  buildDerivedPrompt,
  buildIdlePrompt,
  draftSpecies,
  generateFramePng,
} from '../lib/spriteStudio'
import { processSpritePng } from '../lib/spritePipeline'
import type { SpeciesDraft } from '../lib/spriteStudio'
import type { CustomSpeciesMeta } from '../lib/spriteLibrary'
import { getCustomSpecies, saveSpeciesToLibrary } from '../lib/spriteLibrary'
import { builtinSpeciesCodes } from '../lib/speciesRegistry'
import type { FrameName } from '../lib/speciesArt'
import type { ForgeForm, ForgeStep, FrameStatus } from '../components/care/forge/types'
import { FRAME_META } from '../components/care/forge/types'
import styleRefUrl from '../assets/sprite-ref/style-ref.png'

function createForm(): ForgeForm {
  return {
    code: '',
    name: '',
    emoji: '🌱',
    desc: '',
    states: Object.fromEntries(FRAME_KEYS.map((frame) => [frame, ''])) as Record<FrameName, string>,
    waterIntervalH: 72,
    sunIntervalH: 120,
  }
}

function operationError(error: unknown): string {
  const message = error instanceof Error ? error.message : ''
  if (/401|403|鉴权/.test(message)) return '密钥验证失败，请在上方检查 AI 素材密钥。'
  if (/timeout|超时|abort/i.test(message)) return '请求超时，请稍后重试，已完成的图片会保留。'
  if (/429/.test(message)) return '请求较多，请稍后再试。'
  if (/网络|fetch|network/i.test(message)) return '网络连接失败，请检查网络后重试。'
  return '操作未完成，请稍后重试，已完成的图片会保留。'
}

export function useSpeciesForge(options: { onSaved: (code: string) => void }) {
  const form = reactive<ForgeForm>(createForm())
  const step = shallowRef<ForgeStep>('compose')
  const phrase = shallowRef('')
  const hasDraft = shallowRef(false)
  const isDrafting = shallowRef(false)
  const isGenerating = shallowRef(false)
  const isSaving = shallowRef(false)
  const regeneratingFrame = shallowRef<FrameName | null>(null)
  const errorMessage = shallowRef('')
  const frameStatus = reactive(
    Object.fromEntries(FRAME_KEYS.map((frame) => [frame, 'pending'])) as Record<
      FrameName,
      FrameStatus
    >,
  )
  const frameUrls = reactive<Partial<Record<FrameName, string>>>({})
  const frameBytes = shallowReactive<Partial<Record<FrameName, Uint8Array>>>({})
  const isBusy = computed(
    () =>
      isDrafting.value || isGenerating.value || isSaving.value || regeneratingFrame.value !== null,
  )
  const doneCount = computed(
    () => FRAME_KEYS.filter((frame) => frameStatus[frame] === 'done').length,
  )
  const allDone = computed(() => doneCount.value === FRAME_KEYS.length)
  const hasError = computed(() => FRAME_KEYS.some((frame) => frameStatus[frame] === 'error'))
  let isActive = true
  let styleRefBytes: Uint8Array | null = null
  const localController = new AbortController()

  function clearFrames(): void {
    for (const frame of FRAME_KEYS) {
      if (frameUrls[frame]) URL.revokeObjectURL(frameUrls[frame]!)
      delete frameUrls[frame]
      delete frameBytes[frame]
      frameStatus[frame] = 'pending'
    }
  }

  onUnmounted(() => {
    isActive = false
    localController.abort()
    clearFrames()
    styleRefBytes = null
  })

  async function ensureApiKey(): Promise<string> {
    const settings = await readSettings()
    const key = settings.arkApiKey.trim()
    if (!key) throw new Error('鉴权：缺少密钥')
    return key
  }

  function validateForm(): string {
    if (!/^[a-z][a-z0-9-]*$/.test(form.code)) return '物种标识需使用英文小写、数字和中划线。'
    if (builtinSpeciesCodes().has(form.code)) return '物种标识已被内置植物使用，请换一个。'
    if (!form.name.trim() || !form.desc.trim()) return '请填写植物名称和外形描述。'
    if (FRAME_KEYS.some((frame) => !form.states[frame].trim())) return '请补齐六种状态描述。'
    const intervals = [form.waterIntervalH, form.sunIntervalH]
    if (
      intervals.some(
        (value) => typeof value !== 'number' || !Number.isFinite(value) || value < 6 || value > 720,
      )
    )
      return '养护间隔请填写 6～720 小时。'
    return ''
  }

  async function isCodeAvailable(): Promise<boolean> {
    const existing = await getCustomSpecies(form.code)
    if (!isActive) return false
    if (existing) {
      errorMessage.value = '本机已有相同物种标识，请返回设定修改。'
      return false
    }
    return true
  }

  async function startDraft(): Promise<void> {
    if (isBusy.value) return
    if (!phrase.value.trim()) {
      errorMessage.value = '先输入想生成的植物名。'
      return
    }
    isDrafting.value = true
    errorMessage.value = ''
    try {
      const key = await ensureApiKey()
      if (!isActive) return
      const draft = await draftSpecies(key, phrase.value.trim())
      if (!isActive) return
      applyDraft(draft)
    } catch (error) {
      if (isActive) errorMessage.value = operationError(error)
    } finally {
      if (isActive) isDrafting.value = false
    }
  }

  function applyDraft(draft: SpeciesDraft): void {
    if (builtinSpeciesCodes().has(draft.code)) {
      errorMessage.value = '该物种已内置，请换个植物重新起草。'
      return
    }
    clearFrames()
    Object.assign(form, {
      code: draft.code,
      name: draft.name,
      emoji: draft.emoji,
      desc: draft.desc,
      states: { ...draft.states },
    })
    hasDraft.value = true
  }

  async function getReference(frame: FrameName): Promise<Uint8Array> {
    if (frame !== 'idle') {
      const idle = frameBytes.idle
      if (!idle) throw new Error('缺少基础形象')
      return idle
    }
    if (!styleRefBytes) {
      const response = await fetch(styleRefUrl, { signal: localController.signal })
      if (!response.ok) throw new Error('参考图加载失败')
      styleRefBytes = new Uint8Array(await response.arrayBuffer())
    }
    return styleRefBytes
  }

  async function generateOne(frame: FrameName, apiKey: string): Promise<void> {
    if (!isActive) return
    frameStatus[frame] = 'running'
    try {
      const refPngBytes = await getReference(frame)
      if (!isActive) return
      const prompt =
        frame === 'idle'
          ? buildIdlePrompt(form.desc.trim())
          : buildDerivedPrompt(form.desc.trim(), frame, form.states[frame].trim())
      const bytes = await generateFramePng({ apiKey, prompt, refPngBytes })
      if (!isActive) return
      const preview = await processSpritePng(bytes)
      if (!isActive) return
      if (frameUrls[frame]) URL.revokeObjectURL(frameUrls[frame]!)
      frameBytes[frame] = bytes
      frameUrls[frame] = URL.createObjectURL(new Blob([preview as BlobPart], { type: 'image/png' }))
      frameStatus[frame] = 'done'
    } catch (error) {
      if (isActive) frameStatus[frame] = 'error'
      throw error
    }
  }

  async function generateDerived(apiKey: string): Promise<void> {
    for (const frame of FRAME_KEYS) {
      if (!isActive) return
      if (frame === 'idle') continue
      try {
        await generateOne(frame, apiKey)
      } catch (error) {
        if (isActive)
          errorMessage.value = FRAME_META[frame].label + '生成失败。' + operationError(error)
      }
    }
  }

  async function startGenerate(): Promise<void> {
    if (isBusy.value) return
    errorMessage.value = validateForm()
    if (errorMessage.value) return
    isGenerating.value = true
    try {
      if (!(await isCodeAvailable())) return
      const key = await ensureApiKey()
      if (!isActive) return
      clearFrames()
      step.value = 'generate'
      await generateOne('idle', key)
      if (isActive) await generateDerived(key)
    } catch (error) {
      if (isActive) errorMessage.value = operationError(error)
    } finally {
      if (isActive) isGenerating.value = false
    }
  }

  async function regenerate(frame: FrameName): Promise<void> {
    if (isBusy.value) return
    if (frame !== 'idle' && !frameBytes.idle) {
      errorMessage.value = '请先重试基础形象，再生成其他状态。'
      return
    }
    regeneratingFrame.value = frame
    errorMessage.value = ''
    try {
      const key = await ensureApiKey()
      if (isActive) await generateOne(frame, key)
    } catch (error) {
      if (isActive)
        errorMessage.value = FRAME_META[frame].label + '生成失败。' + operationError(error)
    } finally {
      if (isActive) regeneratingFrame.value = null
    }
  }

  async function collectFrames(): Promise<Partial<Record<FrameName, Uint8Array>>> {
    const frames: Partial<Record<FrameName, Uint8Array>> = {}
    for (const frame of FRAME_KEYS) {
      if (!isActive) throw new Error('操作已失效')
      const bytes = frameBytes[frame]
      if (!bytes) throw new Error('缺少状态图片')
      frames[frame] = await processSpritePng(bytes)
    }
    return frames
  }

  async function saveToLibrary(): Promise<void> {
    if (isBusy.value || !allDone.value) return
    errorMessage.value = validateForm()
    if (errorMessage.value) return
    isSaving.value = true
    try {
      if (!(await isCodeAvailable())) return
      const frames = await collectFrames()
      if (!isActive) return
      await saveSpeciesToLibrary(buildMetadata(), frames)
      if (!isActive) return
      ElMessage.success(form.name.trim() + '已加入物种库，去领养页迎接它吧。')
      options.onSaved(form.code)
    } catch (error) {
      if (isActive) errorMessage.value = '入库失败。' + operationError(error)
    } finally {
      if (isActive) isSaving.value = false
    }
  }

  function buildMetadata(): Omit<CustomSpeciesMeta, 'createdAt'> {
    return {
      code: form.code,
      name: form.name.trim(),
      emoji: form.emoji.trim() || '🌱',
      desc: form.desc.trim(),
      states: { ...form.states },
      waterIntervalH: form.waterIntervalH!,
      sunIntervalH: form.sunIntervalH!,
    }
  }

  function returnToCompose(): void {
    if (isBusy.value) return
    step.value = 'compose'
    errorMessage.value = ''
  }

  return {
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
    isBusy,
    doneCount,
    allDone,
    hasError,
    startDraft,
    startGenerate,
    regenerate,
    saveToLibrary,
    returnToCompose,
  }
}
