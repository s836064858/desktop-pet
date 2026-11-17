import { computed, onUnmounted, shallowRef } from 'vue'
import { planPlant } from '../lib/plantPlanner'
import type { PlantChatMessage, PlantPlan, PlantPlanReply } from '../lib/plantPlan'

interface PendingTurn {
  id: string
  text: string
  hasImage: boolean
  imagePreviewUrl?: string
}

export function usePlantPlanning(options: { onPlan: (plan: PlantPlan) => void }) {
  const message = shallowRef('')
  const messages = shallowRef<PlantChatMessage[]>([])
  const hasReadyPlan = shallowRef(false)
  const planMessageId = shallowRef('')
  const currentPlan = shallowRef<PlantPlan | null>(null)
  const hasUnsentImage = shallowRef(false)
  const isDiscussing = shallowRef(false)
  const canSend = computed(
    () =>
      !isDiscussing.value &&
      message.value.length <= 1000 &&
      (Boolean(message.value.trim()) || hasUnsentImage.value),
  )
  const canRetry = computed(
    () =>
      !isDiscussing.value &&
      messages.value.at(-1)?.id === pending?.id &&
      messages.value.at(-1)?.status === 'error',
  )
  let pending: PendingTurn | null = null
  let isActive = true

  function setTurnStatus(id: string, status: PlantChatMessage['status']): void {
    messages.value = messages.value.map((entry) =>
      entry.id === id ? { ...entry, status } : entry,
    )
  }

  function appendAssistant(text: string): string {
    const id = crypto.randomUUID()
    messages.value = [
      ...messages.value,
      {
        id,
        role: 'assistant' as const,
        text,
        status: 'done' as const,
      },
    ].slice(-40)
    return id
  }

  function beginTurn(input: {
    hasImage: boolean
    imagePreviewUrl?: string
    isRetry?: boolean
  }): PendingTurn {
    if (input.isRetry) {
      if (!canRetry.value || !pending) throw new Error('没有可重试的对话，请重新发送。')
      setTurnStatus(pending.id, 'pending')
      return { ...pending }
    }
    if (!canSend.value)
      throw new Error('请发送一张植物图片或输入需求，文字最多 1000 字。')
    const turn = {
      id: crypto.randomUUID(),
      text: message.value.trim() || '请识别这张植物照片，帮我规划数字分身和养护习性。',
      hasImage: input.hasImage && hasUnsentImage.value,
      imagePreviewUrl: hasUnsentImage.value ? input.imagePreviewUrl : undefined,
    }
    pending = turn
    messages.value = [
      ...messages.value,
      { ...turn, role: 'user' as const, status: 'pending' as const },
    ].slice(-40)
    message.value = ''
    hasUnsentImage.value = false
    return turn
  }

  async function discuss(input: {
    apiKey: string
    signal: AbortSignal
    imageBytes?: Uint8Array
    isRetry?: boolean
    imagePreviewUrl?: string
  }): Promise<void> {
    if (!isActive || isDiscussing.value) return
    input.signal.throwIfAborted()
    const turn = beginTurn({
      hasImage: Boolean(input.imageBytes),
      isRetry: input.isRetry,
      imagePreviewUrl: input.imagePreviewUrl,
    })
    hasReadyPlan.value = false
    isDiscussing.value = true
    try {
      const result = await requestTurn({ ...input, turn })
      input.signal.throwIfAborted()
      if (isActive) acceptReply(turn.id, result)
    } catch (error) {
      if (isActive) setTurnStatus(turn.id, 'error')
      throw error
    } finally {
      if (isActive) isDiscussing.value = false
    }
  }

  function requestTurn(input: {
    apiKey: string
    signal: AbortSignal
    imageBytes?: Uint8Array
    turn: PendingTurn
  }): Promise<PlantPlanReply> {
    return planPlant({
      apiKey: input.apiKey,
      text: input.turn.text,
      imageBytes: input.imageBytes,
      signal: input.signal,
      history: messages.value.filter((entry) => entry.id !== input.turn.id),
      currentPlan: currentPlan.value,
    })
  }

  function acceptReply(id: string, result: PlantPlanReply): void {
    setTurnStatus(id, 'done')
    const replyId = appendAssistant(result.reply)
    pending = null
    if (!result.plan || result.needsClarification) return
    planMessageId.value = replyId
    currentPlan.value = result.plan
    options.onPlan(result.plan)
    hasReadyPlan.value = true
  }

  function photoChanged(hasImage: boolean): void {
    hasReadyPlan.value = false
    currentPlan.value = null
    planMessageId.value = ''
    hasUnsentImage.value = hasImage
    pending = null
    if (messages.value.length)
      appendAssistant(
        hasImage
          ? '植物照片已更新。发送图片或补充说明后，我会重新整理档案。'
          : '植物照片已移除。继续告诉我你的想法，我会据此重新整理档案。',
      )
  }

  onUnmounted(() => {
    isActive = false
    pending = null
  })
  return {
    message,
    messages,
    hasReadyPlan,
    planMessageId,
    canSend,
    canRetry,
    discuss,
    photoChanged,
  }
}
