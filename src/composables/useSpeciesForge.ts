import { computed, onMounted, onUnmounted, shallowRef } from 'vue'
import { ElMessage } from 'element-plus'
import { activateAi, aiClient, AiServiceError, aiWait } from '../lib/aiService'
import { readAiToken, clearAiToken } from '../lib/aiDeviceVault'
import type { AiDraft, AiJob, AiSlot } from '../lib/aiService'
import type { GrowthStage } from '../lib/growth'
import type { ChatProgress, ForgeStep } from '../components/care/forge/types'
import { FRAME_KEYS, GROWTH_STAGE_KEYS } from '../lib/spriteFrames'
import type { FrameName, FrameTarget } from '../lib/spriteFrames'
import { validatePlantPlan } from '../lib/plantPlan'
import type { PlantChatMessage } from '../lib/plantPlan'
import { getCustomSpecies, saveSpeciesToLibrary } from '../lib/spriteLibrary'
import { preparePlantReference } from '../lib/plantReference'
import { useForgeFrames } from './useForgeFrames'
import { clearLegacyArkKey } from '../lib/capabilities'

type Operation = 'load' | 'activate' | 'draft' | 'bases' | 'derive' | 'retry' | 'save' | 'reference' | 'update'
type SubmitInput = { kind: 'chat'; text: string } | { kind: 'bases' | 'derived' } |
  { kind: 'frame'; target: AiSlot } | { kind: 'upload'; jobId: string }
type UpdateInput = { kind: 'reference'; image: string | null } |
  { kind: 'confirm'; stage: GrowthStage; assetId: string } | { kind: 'reset' }

function isPending(job: AiJob): boolean {
  return job.status === 'queued' || job.status === 'running'
}

function canContinueWhileBlocked(job: AiJob): boolean {
  return job.status === 'running' || (job.status === 'queued' && job.isUploadOnly === true)
}

export function useSpeciesForge(options: { onSaved: (code: string) => void }) {
  const frames = useForgeFrames()
  const draft = shallowRef<AiDraft | null>(null)
  const step = shallowRef<ForgeStep>('compose')
  const phrase = shallowRef('')
  const localChat = shallowRef<PlantChatMessage | null>(null)
  const name = shallowRef('')
  const isPaused = shallowRef(false)
  const isAiDisabled = shallowRef(false)
  const operation = shallowRef<Operation | null>(null)
  const errorMessage = shallowRef('')
  const referencePreviewUrl = shallowRef('')
  const regeneratingTarget = shallowRef<FrameTarget | null>(null)
  const loaded = new Map<AiSlot, string>()
  let client: ReturnType<typeof aiClient> | null = null
  let active: AbortController | null = null
  let isMounted = true

  const form = computed(() => draft.value?.plan ? { ...draft.value.plan, code: `plant-${draft.value.id}` } : null)
  const hasQueued = computed(() => Boolean(draft.value?.jobs.some(isPending)))
  const isGenerationBlocked = computed(() => isPaused.value || isAiDisabled.value)
  const hasDraft = computed(() => Boolean(draft.value?.isPlanReady))
  const isBusy = computed(() => operation.value !== null)
  const isSaving = computed(() => operation.value === 'save')
  const isDrafting = computed(() => operation.value === 'draft')
  const isGenerating = computed(() => operation.value === 'bases' || operation.value === 'derive')
  const isReadingReference = computed(() => operation.value === 'reference')
  const chatMessages = computed(() => {
    const snapshot = draft.value
    const plan = snapshot?.isPlanReady ? snapshot.plan : null
    let messages = snapshot?.messages ?? []
    if (plan && !messages.some((message) => message.plan)) {
      const latestReply = messages.filter((message) => message.role === 'assistant').at(-1)
      messages = messages.map((message) => message === latestReply ? { ...message, plan } : message)
    }
    return localChat.value ? [...messages, localChat.value] : messages
  })
  const planMessageId = computed(() => chatMessages.value.filter((item) => item.plan).at(-1)?.id ?? '')
  const chatProgress = computed<ChatProgress | null>(() => {
    if (localChat.value?.status === 'pending') return { label: '正在发送消息', isActive: true }
    const job = draft.value?.jobs.find((item) => item.type === 'chat' && isPending(item))
    if (!job) return null
    if (job.status === 'queued' && isGenerationBlocked.value) {
      return { label: '对话暂缓', description: '恢复 AI 后继续处理。', isActive: false }
    }
    const label = job.status === 'running' ? '正在整理植物方案' : '等待处理你的消息'
    return isBusy.value
      ? { label, isActive: true }
      : { label, description: '可刷新进度查看最新状态。', isActive: false }
  })
  const canSendPlanning = computed(() => !hasQueued.value && !isGenerationBlocked.value && phrase.value.length <= 1000 &&
    Boolean(phrase.value.trim() || draft.value?.hasReference))
  const canGenerate = computed(() => hasDraft.value && !hasQueued.value && !localChat.value && !isGenerationBlocked.value && !phrase.value.trim())
  const canRetryPlanning = computed(() => !hasQueued.value && !isGenerationBlocked.value && chatMessages.value.at(-1)?.status === 'error')

  function requireClient() {
    if (!client) throw new Error('请先激活 AI。')
    return client
  }

  function version() {
    if (!draft.value) throw new Error('草稿尚未加载。')
    return { draftId: draft.value.id, version: draft.value.version }
  }

  function clearSession(): void {
    client = null
    draft.value = null
    localChat.value = null
    name.value = ''
    isPaused.value = false
    isAiDisabled.value = false
    referencePreviewUrl.value = ''
    step.value = 'compose'
    loaded.clear()
    frames.clearAll()
  }

  async function run(kind: Operation, action: (signal: AbortSignal) => Promise<void>): Promise<void> {
    if (active || !isMounted) return
    const controller = new AbortController()
    active = controller
    operation.value = kind
    errorMessage.value = ''
    try {
      await action(controller.signal)
    } catch (error) {
      if (!isMounted || controller.signal.aborted) return
      if (error instanceof AiServiceError && error.status === 401) clearSession()
      errorMessage.value = error instanceof Error ? error.message : '操作未完成，请重试。'
    } finally {
      active = null
      if (isMounted) {
        operation.value = null
        regeneratingTarget.value = null
      }
    }
  }

  async function syncFrame(snapshot: AiDraft, target: FrameTarget, signal: AbortSignal, isRetry: boolean): Promise<void> {
    const { stage, frame } = target
    const slot = `${stage}:${frame}` as const
    const id = snapshot.assets[slot]
    if (loaded.get(slot) === id && (!id || !isRetry || frames.frameStatus[stage][frame] === 'done')) return
    frames.clearFrame(target)
    loaded.delete(slot)
    if (!id) return
    loaded.set(slot, id)
    try {
      await frames.loadFrame({ ...target, signal, download: () => requireClient().download(id, signal) })
    } catch (error) {
      signal.throwIfAborted()
      if (error instanceof AiServiceError && error.status === 401) throw error
    }
  }

  async function syncDraft(signal: AbortSignal, isRetry = false): Promise<AiDraft> {
    const snapshot = await requireClient().draft(signal)
    signal.throwIfAborted()
    if (snapshot.id !== draft.value?.id || snapshot.messages.some(({ id }) => id === localChat.value?.id)) {
      localChat.value = null
    }
    draft.value = snapshot
    if (snapshot.plan) validatePlantPlan(snapshot.plan)
    for (const frame of FRAME_KEYS) {
      for (const stage of GROWTH_STAGE_KEYS) await syncFrame(snapshot, { stage, frame }, signal, isRetry)
    }
    for (const stage of GROWTH_STAGE_KEYS) frames.confirmedBases[stage] = snapshot.confirmed.includes(stage)
    for (const job of snapshot.jobs) {
      if (job.target === 'chat' || job.status === 'done') continue
      const [stage, frame] = job.target.split(':') as [GrowthStage, FrameName]
      if (isPending(job)) frames.frameStatus[stage][frame] = job.status === 'running' ? 'running' : 'pending'
      else if (!snapshot.assets[job.target]) {
        frames.frameStatus[stage][frame] = 'error'
        frames.frameErrors[stage][frame] = job.errorMessage ?? '任务未完成。'
      } else if (frames.anchors[stage][frame]) frames.frameStatus[stage][frame] = 'done'
    }
    return snapshot
  }

  function chooseStep(snapshot: AiDraft): void {
    if (snapshot.jobs.some((job) => job.target === 'chat') || !snapshot.plan) step.value = 'compose'
    else if (snapshot.jobs.some((job) => job.target.endsWith(':idle') && isPending(job))) step.value = 'bases'
    else if (snapshot.jobs.some(isPending)) step.value = 'generate'
    else if (snapshot.confirmed.length === 3) step.value = 'gallery'
    else if (Object.keys(snapshot.assets).length || snapshot.jobs.some((job) => job.type === 'image')) step.value = 'bases'
    else step.value = 'compose'
  }

  async function waitForJobs(snapshot: AiDraft, signal: AbortSignal): Promise<void> {
    let latest = snapshot
    while (latest.jobs.some(isPending)) {
      if (isGenerationBlocked.value && !latest.jobs.some(canContinueWhileBlocked)) return
      await aiWait(signal)
      await syncStatus(signal)
      latest = await syncDraft(signal)
    }
    if (step.value === 'generate') step.value = 'gallery'
    const failures = latest.jobs.map((job) => job.errorMessage)
      .filter((message) => message && !latest.messages.some((entry) => entry.errorMessage === message))
    if (failures.length) errorMessage.value = [...new Set(failures)].join('\n')
  }

  async function syncStatus(signal: AbortSignal): Promise<void> {
    const status = await requireClient().status(signal)
    signal.throwIfAborted()
    name.value = status.name
    isPaused.value = status.isPaused
    isAiDisabled.value = status.isAiDisabled === true
  }

  async function connect(token: string, signal: AbortSignal): Promise<void> {
    client = aiClient(token)
    await syncStatus(signal)
    const snapshot = await syncDraft(signal, true)
    referencePreviewUrl.value = snapshot.hasReference ? (await client.reference(signal)).image ?? '' : ''
    signal.throwIfAborted()
    chooseStep(snapshot)
    if (snapshot.jobs.some(isPending)) await waitForJobs(snapshot, signal)
  }

  function reload(): Promise<void> {
    return run('load', async (signal) => {
      await clearLegacyArkKey()
      signal.throwIfAborted()
      const token = await readAiToken()
      if (token) await connect(token, signal)
    })
  }

  function activate(input: { code: string; name: string }): Promise<void> {
    return run('activate', async (signal) => {
      const token = await activateAi({ ...input, signal })
      await connect(token, signal)
    })
  }

  function forgetActivation(): Promise<void> {
    return run('load', async (signal) => {
      await clearAiToken()
      signal.throwIfAborted()
      clearSession()
    })
  }

  async function submit(input: SubmitInput, signal: AbortSignal, operationId: string = crypto.randomUUID()): Promise<void> {
    try {
      await requireClient().submit({ ...input, ...version(), operationId }, signal)
    } catch (error) {
      signal.throwIfAborted()
      if (error instanceof AiServiceError && error.status === 403) isAiDisabled.value = true
      throw error
    }
    signal.throwIfAborted()
    await waitForJobs(await syncDraft(signal), signal)
  }

  function sendChat(text: string, retryId?: string): Promise<void> {
    return run('draft', async (signal) => {
      const id = retryId ?? crypto.randomUUID()
      localChat.value = { id, role: 'user', text, status: 'pending', hasImage: draft.value?.hasReference }
      if (!retryId) phrase.value = ''
      try {
        if (retryId) {
          const snapshot = await syncDraft(signal)
          if (!localChat.value) return waitForJobs(snapshot, signal)
        }
        await submit({ kind: 'chat', text }, signal, id)
      } catch (error) {
        if (signal.aborted || localChat.value?.id !== id || (error instanceof AiServiceError && error.status === 401)) throw error
        localChat.value = { ...localChat.value, status: 'error',
          errorMessage: error instanceof Error ? error.message : '发送未完成，请重试。' }
      }
    })
  }

  function startDraft(): Promise<void> {
    if (!canSendPlanning.value) return Promise.resolve()
    const referencePrompt = draft.value?.plan
      ? '请结合这张参考照片和前文，更新植物方案。'
      : '请参考这张照片和前文，规划植物数字分身和养护习性。'
    const text = phrase.value.trim() || referencePrompt
    return sendChat(text)
  }

  function retryDraft(): Promise<void> {
    const last = chatMessages.value.at(-1)
    if (!canRetryPlanning.value || last?.role !== 'user') return Promise.resolve()
    return sendChat(last.text, localChat.value?.id)
  }

  function startGenerate(): Promise<void> {
    return run('bases', async (signal) => {
      step.value = 'bases'
      if (GROWTH_STAGE_KEYS.every((stage) => draft.value?.assets[`${stage}:idle`])) return
      await submit({ kind: 'bases' }, signal)
    })
  }

  function startDerived(): Promise<void> {
    return run('derive', async (signal) => {
      step.value = 'generate'
      await submit({ kind: 'derived' }, signal)
    })
  }

  function regenerate(target: FrameTarget): Promise<void> {
    const slot = `${target.stage}:${target.frame}` as const
    const jobId = draft.value?.uploadRetries[slot]
    if (isGenerationBlocked.value && !jobId) return Promise.resolve()
    return run('retry', async (signal) => {
      regeneratingTarget.value = target
      await submit(jobId ? { kind: 'upload', jobId } : { kind: 'frame', target: slot }, signal)
      if (target.frame === 'idle' && draft.value && !draft.value.confirmed.includes(target.stage)) {
        step.value = 'bases'
      }
    })
  }

  async function update(body: UpdateInput, signal: AbortSignal): Promise<void> {
    await requireClient().update({ ...body, ...version() }, signal)
    await syncDraft(signal)
    if (body.kind === 'reference' || body.kind === 'reset') localChat.value = null
  }

  function confirmBase(stage: GrowthStage): Promise<void> {
    const assetId = draft.value?.assets[`${stage}:idle`]
    if (!assetId || !frames.anchors[stage].idle) return Promise.resolve()
    return run('update', (signal) => update({ kind: 'confirm', stage, assetId }, signal))
  }

  function uploadReference(file: File): Promise<void> {
    return run('reference', async (signal) => {
      const image = await preparePlantReference({ file, signal })
      let binary = ''
      for (let offset = 0; offset < image.bytes.length; offset += 16_384) {
        binary += String.fromCharCode(...image.bytes.subarray(offset, offset + 16_384))
      }
      const data = `data:image/png;base64,${btoa(binary)}`
      await update({ kind: 'reference', image: data }, signal)
      referencePreviewUrl.value = data
    })
  }

  function removeReference(): Promise<void> {
    return run('reference', async (signal) => {
      await update({ kind: 'reference', image: null }, signal)
      referencePreviewUrl.value = ''
    })
  }

  function startOver(): Promise<void> {
    return run('update', async (signal) => {
      await update({ kind: 'reset' }, signal)
      referencePreviewUrl.value = ''
      phrase.value = ''
      step.value = 'compose'
    })
  }

  function saveToLibrary(): Promise<void> {
    if (!frames.isAllDone.value || !form.value) return Promise.resolve()
    return run('save', async (signal) => {
      const plan = form.value
      if (!plan) return
      if (!(await getCustomSpecies(plan.code))) {
        await saveSpeciesToLibrary({ ...plan, artVersion: 2, alignment: { version: 1, method: 'automatic', anchors: {
          juvenile: { ...frames.anchors.juvenile }, adult: { ...frames.anchors.adult }, full: { ...frames.anchors.full },
        } } }, frames.processedBytes, signal)
      }
      signal.throwIfAborted()
      await requireClient().update({ kind: 'reset', ...version() }, signal).catch(() => undefined)
      signal.throwIfAborted()
      ElMessage.success(`${plan.name}已加入植物库。`)
      options.onSaved(plan.code)
    })
  }

  function cancelOperation(): void {
    if (!isSaving.value && active) {
      active.abort()
      const message = '已停止等待。已提交任务会继续，可刷新进度或稍后打开向导。'
      if (localChat.value?.status === 'pending') {
        localChat.value = { ...localChat.value, status: 'error', errorMessage: message }
      } else errorMessage.value = message
    }
  }

  function goToStep(next: ForgeStep): void {
    if (!active) {
      step.value = next
      errorMessage.value = ''
    }
  }

  onMounted(reload)
  onUnmounted(() => {
    isMounted = false
    active?.abort()
  })

  return { ...frames, draft, form, step, phrase, name, isPaused, isAiDisabled, isGenerationBlocked, hasQueued, operation, hasDraft, canGenerate,
    chatMessages, chatProgress, planMessageId, canSendPlanning, canRetryPlanning, isDrafting, isGenerating, isSaving,
    isReadingReference, referencePreviewUrl, isBusy, regeneratingTarget, errorMessage, activate, reload,
    forgetActivation, startOver, startDraft, retryDraft, startGenerate, confirmBase, startDerived, regenerate,
    saveToLibrary, cancelOperation, goToStep, uploadReference, removeReference }
}
