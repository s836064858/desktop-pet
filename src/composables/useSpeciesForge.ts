import { computed, onUnmounted, reactive, shallowRef } from 'vue'
import { ElMessage } from 'element-plus'
import { readSettings } from '../lib/capabilities'
import { validateGrowthDescriptions } from '../lib/plantPlan'
import type { PlantPlan } from '../lib/plantPlan'
import type { CustomSpeciesMeta } from '../lib/spriteLibrary'
import { getCustomSpecies, saveSpeciesToLibrary } from '../lib/spriteLibrary'
import { FRAME_KEYS, GROWTH_STAGE_KEYS, GROWTH_STAGE_LABELS } from '../lib/spriteFrames'
import type { FrameName, FrameTarget, GrowthFrames } from '../lib/spriteFrames'
import type { GrowthStage } from '../lib/growth'
import type { ForgeForm, ForgeStep } from '../components/care/forge/types'
import { FRAME_META } from '../components/care/forge/types'
import { useForgeFrames } from './useForgeFrames'
import styleRefUrl from '../assets/sprite-ref/style-ref.png'
import { createCareProfile, validateCareProfile } from '../lib/careProfile'
import type { SpriteAnchor } from '../lib/spriteAlignment'
import { usePlantReference } from './usePlantReference'
import { usePlantPlanning } from './usePlantPlanning'

type Operation = 'draft' | 'bases' | 'derive' | 'retry' | 'save' | 'reference'

function createForm(): ForgeForm {
  return {
    code: 'plant-' + crypto.randomUUID(),
    name: '',
    emoji: '🌱',
    desc: '',
    states: Object.fromEntries(FRAME_KEYS.map((frame) => [frame, ''])) as Record<
      FrameName,
      string
    >,
    stages: { juvenile: '', adult: '', full: '' },
    careProfile: createCareProfile(),
  }
}

function operationError(error: unknown): string {
  const raw = (error instanceof Error ? error.message : String(error)).trim()
  const detail = raw.length > 300 ? raw.slice(0, 300) + '…' : raw
  if (
    /401|403|鉴权|AuthenticationFailed|InvalidAccessToken|ExpiredAccessToken|AccessDenied/.test(
      raw,
    )
  )
    return '密钥验证失败，请在上方检查 AI 素材密钥。'
  if (/ModelNotOpen|InvalidEndpointOrModel|OpenServiceRejected|未开通/.test(raw))
    return '方舟模型尚未开通，请按教程在控制台「开通管理」中开通所需模型。'
  if (/429|FlowLimit|ReqThrottle|Quota/.test(raw))
    return '请求较多或配额不足，请稍后再试。'
  if (/DataInspectionFailed|SensitiveContentDetected|内容审核|敏感/.test(raw))
    return '内容未通过平台审核，请调整植物外形或状态描述后重试。'
  return detail || '操作未完成，请稍后重试，已完成的图片会保留。'
}

function shouldStopBatch(error: unknown): boolean {
  return /401|403|429|鉴权|ModelNotOpen|InvalidEndpointOrModel|OpenServiceRejected|FlowLimit|Quota|网络|HTTP 5\d\d/.test(
    String(error),
  )
}

export function useSpeciesForge(options: { onSaved: (code: string) => void }) {
  const form = reactive<ForgeForm>(createForm())
  const step = shallowRef<ForgeStep>('compose')
  const operation = shallowRef<Operation | null>(null)
  const isCancelling = shallowRef(false)
  const regeneratingTarget = shallowRef<FrameTarget | null>(null)
  const errorMessage = shallowRef('')
  const frames = useForgeFrames(form)
  const plantReference = usePlantReference()
  const planning = usePlantPlanning({ onPlan: applyPlan })
  const phrase = planning.message
  const hasDraft = planning.hasReadyPlan
  const canGenerate = computed(() => hasDraft.value && !phrase.value.trim())
  const referenceMessage = shallowRef('')
  const isBusy = computed(() => operation.value !== null)
  const isDrafting = computed(() => operation.value === 'draft')
  const isGenerating = computed(
    () => operation.value === 'bases' || operation.value === 'derive',
  )
  const isSaving = computed(() => operation.value === 'save')
  const isReadingReference = computed(() => operation.value === 'reference')
  let isActive = true
  let controller: AbortController | null = null
  let styleRefBytes: Uint8Array | null = null

  onUnmounted(() => {
    isActive = false
    controller?.abort()
    styleRefBytes = null
  })

  async function runOperation(
    kind: Operation,
    action: (signal: AbortSignal) => Promise<void>,
  ): Promise<void> {
    if (!isActive || isBusy.value) return
    const current = new AbortController()
    controller = current
    operation.value = kind
    errorMessage.value = ''
    try {
      await action(current.signal)
    } catch (error) {
      if (isActive)
        errorMessage.value = current.signal.aborted
          ? kind === 'reference'
            ? '已停止读取，原参考图和已完成的图片会保留。'
            : kind === 'draft'
              ? '对话已停止，内容已保留，可重试本轮或继续发送。'
              : '已停止。已完成的图片保留在本次窗口中，可继续补齐；关闭窗口后将丢弃。'
          : operationError(error)
    } finally {
      finishOperation()
    }
  }

  function finishOperation(): void {
    controller = null
    if (!isActive) return
    operation.value = null
    regeneratingTarget.value = null
    isCancelling.value = false
  }

  async function ensureApiKey(signal: AbortSignal): Promise<string> {
    const settings = await readSettings()
    signal.throwIfAborted()
    const key = settings.arkApiKey.trim()
    if (!key) throw new Error('鉴权：缺少密钥')
    return key
  }

  function validateForm(): void {
    if (!canGenerate.value)
      throw new Error('请先在对话中明确植物档案，未发送的修改需先发送或清空。')
    if (!/^[a-z][a-z0-9-]{0,63}$/.test(form.code))
      throw new Error('物种标识需为 64 字以内的英文小写、数字和中划线。')
    if (
      !form.name.trim() ||
      form.name.length > 12 ||
      !form.desc.trim() ||
      form.desc.length > 120
    )
      throw new Error('请填写植物名称（1–12 字）和外形描述（1–120 字）。')
    if (
      FRAME_KEYS.some(
        (frame) => !form.states[frame].trim() || form.states[frame].length > 100,
      )
    )
      throw new Error('请补齐六种状态描述，每条 1–100 字。')
    validateGrowthDescriptions(form.stages)
    validateCareProfile(form.careProfile)
  }

  async function validateAvailability(signal: AbortSignal): Promise<void> {
    validateForm()
    const existing = await getCustomSpecies(form.code)
    signal.throwIfAborted()
    if (existing) throw new Error('本地植物档案编号冲突，请重新打开创建窗口再试。')
  }

  function applyPlan(plan: PlantPlan): void {
    const next: ForgeForm = { ...plan, code: form.code }
    frames.invalidateForm(next)
    Object.assign(form, next)
  }

  async function startDraft(): Promise<void> {
    await sendPlanning({})
  }

  async function retryDraft(): Promise<void> {
    await sendPlanning({ isRetry: true })
  }

  async function sendPlanning(options: { isRetry?: boolean }): Promise<void> {
    await runOperation('draft', async (signal) => {
      const key = await ensureApiKey(signal)
      referenceMessage.value = ''
      await planning.discuss({
        apiKey: key,
        signal,
        imageBytes: plantReference.getBytes() ?? undefined,
        imagePreviewUrl: plantReference.previewUrl.value,
        isRetry: options.isRetry,
      })
    })
  }

  async function getStyleReference(signal: AbortSignal): Promise<Uint8Array> {
    if (styleRefBytes) return styleRefBytes
    const response = await fetch(styleRefUrl, { signal })
    if (!response.ok) throw new Error('参考图加载失败，请重试。')
    const bytes = new Uint8Array(await response.arrayBuffer())
    signal.throwIfAborted()
    styleRefBytes = bytes
    return bytes
  }

  async function generateTargets(
    targets: FrameTarget[],
    signal: AbortSignal,
  ): Promise<void> {
    const key = await ensureApiKey(signal)
    const failures: string[] = []
    for (const target of targets) {
      signal.throwIfAborted()
      try {
        await generateTarget({ target, apiKey: key, signal })
      } catch (error) {
        signal.throwIfAborted()
        if (shouldStopBatch(error)) throw error
        failures.push(
          `${GROWTH_STAGE_LABELS[target.stage]}·${FRAME_META[target.frame].label}：${operationError(error)}`,
        )
      }
    }
    if (failures.length) throw new Error(failures.join('\n'))
  }

  async function generateTarget(options: {
    target: FrameTarget
    apiKey: string
    signal: AbortSignal
  }): Promise<void> {
    const { target, apiKey, signal } = options
    const reference =
      target.frame === 'idle'
        ? await getStyleReference(signal)
        : frames.getBaseBytes(target.stage)
    const plantRefPngBytes =
      target.frame === 'idle' ? (plantReference.getBytes() ?? undefined) : undefined
    await frames.generateOne({ ...target, apiKey, reference, plantRefPngBytes, signal })
  }

  async function startGenerate(): Promise<void> {
    await runOperation('bases', async (signal) => {
      await validateAvailability(signal)
      step.value = 'bases'
      const targets = GROWTH_STAGE_KEYS.filter(
        (stage) => frames.frameStatus[stage].idle !== 'done',
      ).map((stage) => ({ stage, frame: 'idle' as const }))
      if (targets.length) await generateTargets(targets, signal)
    })
  }

  async function uploadReference(file: File): Promise<void> {
    await runOperation('reference', async (signal) => {
      referenceMessage.value = ''
      const hasGeneratedFrames = frames.doneCount.value > 0
      await plantReference.replace({ file, signal })
      signal.throwIfAborted()
      frames.clearAll()
      planning.photoChanged(true)
      referenceMessage.value = hasGeneratedFrames
        ? '照片已更新，请重新发送以确认档案；旧形象与状态已清除。'
        : '照片已就绪，直接发送即可识别和规划，不必先填写植物名称。'
    })
  }

  function removeReference(): void {
    if (isBusy.value || !plantReference.getBytes()) return
    const hasGeneratedFrames = frames.doneCount.value > 0
    plantReference.clear()
    frames.clearAll()
    planning.photoChanged(false)
    referenceMessage.value = hasGeneratedFrames
      ? '已移除植物参考图；将使用芽伴默认参考，原有生成结果已清除。'
      : '已移除植物参考图，将使用芽伴默认参考。'
  }

  function confirmBase(stage: GrowthStage): void {
    if (!isBusy.value) frames.confirmBase(stage)
  }

  async function startDerived(): Promise<void> {
    if (!frames.hasConfirmedBases.value) return
    await runOperation('derive', async (signal) => {
      await validateAvailability(signal)
      step.value = 'generate'
      const targets = GROWTH_STAGE_KEYS.flatMap((stage) =>
        FRAME_KEYS.filter(
          (frame) => frame !== 'idle' && frames.frameStatus[stage][frame] !== 'done',
        ).map((frame) => ({ stage, frame })),
      )
      if (targets.length) await generateTargets(targets, signal)
      signal.throwIfAborted()
      step.value = 'gallery'
    })
  }

  async function regenerate(target: FrameTarget): Promise<void> {
    if (target.frame !== 'idle' && !frames.hasConfirmedBases.value) return
    await runOperation('retry', async (signal) => {
      regeneratingTarget.value = target
      if (target.frame === 'idle') step.value = 'bases'
      await generateTargets([target], signal)
    })
  }

  async function saveToLibrary(): Promise<void> {
    if (!frames.isAllDone.value) return
    await runOperation('save', async (signal) => {
      await validateAvailability(signal)
      await saveSpeciesToLibrary(buildMetadata(), frames.processedBytes, signal)
      if (!isActive) return
      ElMessage.success(form.name.trim() + '已加入植物库，去领养页迎接它吧。')
      options.onSaved(form.code)
    })
  }

  function buildMetadata(): Omit<CustomSpeciesMeta, 'createdAt'> {
    return {
      code: form.code,
      name: form.name.trim(),
      emoji: form.emoji.trim() || '🌱',
      desc: form.desc.trim(),
      states: { ...form.states },
      stages: { ...form.stages },
      artVersion: 2,
      careProfile: validateCareProfile(form.careProfile),
      alignment: { version: 1, method: 'automatic', anchors: buildAlignmentAnchors() },
    }
  }

  function buildAlignmentAnchors(): GrowthFrames<SpriteAnchor> {
    return {
      juvenile: { ...frames.anchors.juvenile },
      adult: { ...frames.anchors.adult },
      full: { ...frames.anchors.full },
    }
  }

  function cancelOperation(): void {
    if (!controller || isSaving.value) return
    isCancelling.value = true
    controller.abort()
  }

  function goToStep(next: ForgeStep): void {
    if (isBusy.value) return
    step.value = next
    errorMessage.value = ''
  }

  return {
    form,
    step,
    phrase,
    hasDraft,
    canGenerate,
    chatMessages: planning.messages,
    planMessageId: planning.planMessageId,
    canSendPlanning: planning.canSend,
    canRetryPlanning: planning.canRetry,
    isDrafting,
    isGenerating,
    isSaving,
    isReadingReference,
    referencePreviewUrl: plantReference.previewUrl,
    referenceFileName: plantReference.fileName,
    referenceDimensions: plantReference.dimensions,
    referenceMessage,
    isBusy,
    isCancelling,
    regeneratingTarget,
    errorMessage,
    frameStatus: frames.frameStatus,
    frameUrls: frames.frameUrls,
    frameErrors: frames.frameErrors,
    confirmedBases: frames.confirmedBases,
    hasConfirmedBases: frames.hasConfirmedBases,
    doneCount: frames.doneCount,
    checkedCount: frames.checkedCount,
    isAllDone: frames.isAllDone,
    startDraft,
    retryDraft,
    startGenerate,
    confirmBase,
    startDerived,
    regenerate,
    saveToLibrary,
    cancelOperation,
    goToStep,
    uploadReference,
    removeReference,
  }
}
