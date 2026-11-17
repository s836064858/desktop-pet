import { computed, onUnmounted, reactive, shallowReactive } from 'vue'
import { buildGrowthPrompt, generateFramePng } from '../lib/spriteStudio'
import { autoCheckSprite } from '../lib/spriteAutoCheck'
import type { SpriteGeometry } from '../lib/spriteDetection'
import type { SpriteAnchor } from '../lib/spriteAlignment'
import { createGrowthFrames, FRAME_KEYS, GROWTH_STAGE_KEYS } from '../lib/spriteFrames'
import type { FrameTarget, GrowthFrames } from '../lib/spriteFrames'
import type { GrowthStage } from '../lib/growth'
import type { ForgeForm, GrowthFrameStatus } from '../components/care/forge/types'

interface GenerateOptions extends FrameTarget {
  apiKey: string
  reference: Uint8Array
  plantRefPngBytes?: Uint8Array
  signal: AbortSignal
}

export function useForgeFrames(form: ForgeForm) {
  const frameStatus = reactive<GrowthFrameStatus>(createGrowthFrames())
  const frameUrls = reactive<GrowthFrames<string>>(createGrowthFrames())
  const anchors = reactive<GrowthFrames<SpriteAnchor>>(createGrowthFrames())
  const frameErrors = reactive<GrowthFrames<string>>(createGrowthFrames())
  const geometries = createGrowthFrames<SpriteGeometry>()
  const frameBytes = shallowReactive(createGrowthFrames<Uint8Array>())
  const processedBytes = shallowReactive(createGrowthFrames<Uint8Array>())
  const confirmedBases = reactive({ juvenile: false, adult: false, full: false })
  const hasConfirmedBases = computed(() =>
    GROWTH_STAGE_KEYS.every(
      (stage) =>
        confirmedBases[stage] &&
        frameStatus[stage].idle === 'done' &&
        Boolean(anchors[stage].idle),
    ),
  )
  const doneCount = computed(() =>
    GROWTH_STAGE_KEYS.reduce(
      (count, stage) =>
        count + FRAME_KEYS.filter((frame) => frameStatus[stage][frame] === 'done').length,
      0,
    ),
  )
  const checkedCount = computed(() =>
    GROWTH_STAGE_KEYS.reduce(
      (count, stage) =>
        count +
        FRAME_KEYS.filter(
          (frame) => frameStatus[stage][frame] === 'done' && anchors[stage][frame],
        ).length,
      0,
    ),
  )
  const isAllDone = computed(
    () => hasConfirmedBases.value && doneCount.value === 18 && checkedCount.value === 18,
  )
  let isActive = true

  function clearFrame({ stage, frame }: FrameTarget): void {
    const url = frameUrls[stage][frame]
    if (url) URL.revokeObjectURL(url)
    delete frameUrls[stage][frame]
    delete anchors[stage][frame]
    delete frameErrors[stage][frame]
    delete geometries[stage][frame]
    delete frameBytes[stage][frame]
    delete processedBytes[stage][frame]
    frameStatus[stage][frame] = 'pending'
  }

  function clearDerived(stage: GrowthStage): void {
    for (const frame of FRAME_KEYS) {
      if (frame !== 'idle') clearFrame({ stage, frame })
    }
  }

  function clearStage(stage: GrowthStage): void {
    confirmedBases[stage] = false
    for (const frame of FRAME_KEYS) clearFrame({ stage, frame })
  }

  function clearAll(): void {
    for (const stage of GROWTH_STAGE_KEYS) clearStage(stage)
  }

  function invalidateForm(next: ForgeForm): void {
    const hasChangedIdentity =
      form.desc !== next.desc || form.states.idle !== next.states.idle
    for (const stage of GROWTH_STAGE_KEYS) {
      if (hasChangedIdentity || form.stages[stage] !== next.stages[stage]) {
        clearStage(stage)
        continue
      }
      for (const frame of FRAME_KEYS) {
        if (form.states[frame] !== next.states[frame]) clearFrame({ stage, frame })
      }
    }
  }

  function confirmBase(stage: GrowthStage): void {
    if (frameStatus[stage].idle === 'done' && anchors[stage].idle)
      confirmedBases[stage] = true
  }

  function requestFrame(options: GenerateOptions): Promise<Uint8Array> {
    const { stage, frame } = options
    return generateFramePng({
      apiKey: options.apiKey,
      refPngBytes: options.reference,
      plantRefPngBytes: frame === 'idle' ? options.plantRefPngBytes : undefined,
      prompt: buildGrowthPrompt({
        desc: form.desc,
        stage,
        stageDescription: form.stages[stage],
        frame,
        speciesState: form.states[frame],
        hasPlantReference: frame === 'idle' && Boolean(options.plantRefPngBytes),
      }),
      signal: options.signal,
    })
  }

  async function generateOne(options: GenerateOptions): Promise<void> {
    const { stage, frame, signal } = options
    signal.throwIfAborted()
    const previous = frameStatus[stage][frame] ?? 'pending'
    frameStatus[stage][frame] = 'running'
    delete frameErrors[stage][frame]
    try {
      const bytes = await requestFrame(options)
      signal.throwIfAborted()
      await checkAndAcceptFrame({ stage, frame, bytes, signal })
    } catch (error) {
      if (isActive) frameStatus[stage][frame] = signal.aborted ? previous : 'error'
      if (isActive && !signal.aborted)
        frameErrors[stage][frame] =
          error instanceof Error ? error.message : '自动检查失败，请重试。'
      throw error
    }
  }

  async function checkAndAcceptFrame(
    options: FrameTarget & { bytes: Uint8Array; signal: AbortSignal },
  ): Promise<void> {
    const { stage, frame, bytes, signal } = options
    frameStatus[stage][frame] = 'checking'
    const checked = await autoCheckSprite({
      png: bytes,
      reference: referenceGeometry({ stage, frame }),
      signal,
    })
    signal.throwIfAborted()
    acceptFrame({
      stage,
      frame,
      bytes,
      preview: checked.bytes,
      geometry: checked.geometry,
    })
  }

  function referenceGeometry({ stage, frame }: FrameTarget): SpriteGeometry | undefined {
    if (frame !== 'idle') return geometries[stage].idle
    const other = GROWTH_STAGE_KEYS.find(
      (candidate) => candidate !== stage && geometries[candidate].idle,
    )
    return other ? geometries[other].idle : undefined
  }

  function acceptFrame(
    options: FrameTarget & {
      bytes: Uint8Array
      preview: Uint8Array
      geometry: SpriteGeometry
    },
  ): void {
    const { stage, frame, bytes, preview } = options
    if (frame === 'idle') {
      clearDerived(stage)
      confirmedBases[stage] = false
    }
    clearFrame({ stage, frame })
    frameBytes[stage][frame] = bytes
    processedBytes[stage][frame] = preview
    geometries[stage][frame] = options.geometry
    anchors[stage][frame] = { ...options.geometry.anchor }
    frameUrls[stage][frame] = URL.createObjectURL(
      new Blob([preview as BlobPart], { type: 'image/png' }),
    )
    frameStatus[stage][frame] = 'done'
  }

  function getBaseBytes(stage: GrowthStage): Uint8Array {
    const bytes = frameBytes[stage].idle
    if (!bytes || !confirmedBases[stage]) throw new Error('请先确认该阶段的基础形象。')
    return bytes
  }

  onUnmounted(() => {
    isActive = false
    clearAll()
  })

  return {
    frameStatus,
    frameUrls,
    anchors,
    frameErrors,
    processedBytes,
    confirmedBases,
    hasConfirmedBases,
    doneCount,
    checkedCount,
    isAllDone,
    clearAll,
    invalidateForm,
    confirmBase,
    generateOne,
    getBaseBytes,
  }
}
