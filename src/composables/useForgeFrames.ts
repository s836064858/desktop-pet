import { computed, onUnmounted, reactive, shallowReactive } from 'vue'
import { checkSpriteInWorker } from '../lib/spriteCheckClient'
import type { SpriteGeometry } from '../lib/spriteDetection'
import type { SpriteAnchor } from '../lib/spriteAlignment'
import { createGrowthFrames, FRAME_KEYS, GROWTH_STAGE_KEYS } from '../lib/spriteFrames'
import type { FrameTarget, GrowthFrames } from '../lib/spriteFrames'
import type { GrowthStage } from '../lib/growth'
import type { GrowthFrameStatus } from '../components/care/forge/types'

interface GenerateOptions extends FrameTarget {
  download: () => Promise<Uint8Array>
  signal: AbortSignal
}

export function useForgeFrames() {
  const frameStatus = reactive<GrowthFrameStatus>(createGrowthFrames())
  const frameUrls = reactive<GrowthFrames<string>>(createGrowthFrames())
  const anchors = reactive<GrowthFrames<SpriteAnchor>>(createGrowthFrames())
  const frameErrors = reactive<GrowthFrames<string>>(createGrowthFrames())
  const geometries = createGrowthFrames<SpriteGeometry>()
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
    delete processedBytes[stage][frame]
    frameStatus[stage][frame] = 'pending'
  }

  function clearStage(stage: GrowthStage): void {
    confirmedBases[stage] = false
    for (const frame of FRAME_KEYS) clearFrame({ stage, frame })
  }

  function clearAll(): void {
    for (const stage of GROWTH_STAGE_KEYS) clearStage(stage)
  }

  async function loadFrame(options: GenerateOptions): Promise<void> {
    const { stage, frame, signal } = options
    signal.throwIfAborted()
    const previous = frameStatus[stage][frame] ?? 'pending'
    frameStatus[stage][frame] = 'running'
    delete frameErrors[stage][frame]
    try {
      const bytes = await options.download()
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
    const checked = await checkSpriteInWorker({
      png: bytes,
      reference: referenceGeometry({ stage, frame }),
      signal,
    })
    signal.throwIfAborted()
    acceptFrame({
      stage,
      frame,
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
      preview: Uint8Array
      geometry: SpriteGeometry
    },
  ): void {
    const { stage, frame, preview } = options
    clearFrame({ stage, frame })
    processedBytes[stage][frame] = preview
    geometries[stage][frame] = options.geometry
    anchors[stage][frame] = { ...options.geometry.anchor }
    frameUrls[stage][frame] = URL.createObjectURL(
      new Blob([preview as BlobPart], { type: 'image/png' }),
    )
    frameStatus[stage][frame] = 'done'
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
    clearFrame,
    loadFrame,
  }
}
