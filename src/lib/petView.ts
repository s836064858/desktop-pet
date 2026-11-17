import { getSpeciesFrame, hasSpeciesArt } from './speciesArt'
import type { FrameName } from './speciesArt'
import type { GrowthStage } from './growth'

export type NeedType = 'water' | 'sun'
export type BaseState = 'idle' | 'thirsty'

const FALLBACK_SPECIES = 'pothos'

// 未领养态：盆里还没有植物，整窗只显示空盆 idle 帧（伪物种，素材见 assets-src/空盆 + sprite-species.json 的 empty-pot）
const UNADOPTED_SPECIES = 'empty-pot'
let currentSpecies = FALLBACK_SPECIES
let isUnadopted = false
let currentStage: GrowthStage = 'juvenile'
let transientVersion = 0
let resolveTransient: (() => void) | null = null

export function setSpeciesFrames(speciesCode: string): void {
  cancelTransient()
  currentSpecies = hasSpeciesArt(speciesCode) ? speciesCode : FALLBACK_SPECIES
  currentStage = 'juvenile'
}

export function isUnadoptedView(): boolean {
  return isUnadopted
}

// 进入/退出未领养态。进入时停掉瞬帧与眨眼并钉住空盆帧；退出后由调用方设置物种帧与基础态
export function setUnadopted(view: PetViewElements, on: boolean): void {
  isUnadopted = on
  if (!on) {
    return
  }
  cancelTransient()
  if (blinkTimer !== null) clearInterval(blinkTimer)
  blinkTimer = null
  isBlinking = false
  const frame = getSpeciesFrame(UNADOPTED_SPECIES, 'idle')
  if (frame) {
    view.img.src = frame
  }
  view.plant.style.setProperty('--species-hue', '0deg')
  applyStage(view, 0)
}

function frameOf(name: FrameName): string {
  const frame =
    getSpeciesFrame(currentSpecies, name, currentStage) ??
    getSpeciesFrame(FALLBACK_SPECIES, name, currentStage)
  if (!frame) {
    throw new Error(`缺少帧资源：${currentSpecies}/${name}`)
  }
  return frame
}

const BUBBLE_HOLD_MS = 1900
const BOUNCE_HOLD_MS = 550
const BLINK_HOLD_MS = 130
const STAGE_CODES: GrowthStage[] = ['juvenile', 'adult', 'full']
const MAX_HEARTS = 8

export interface PetViewElements {
  plant: HTMLElement
  img: HTMLImageElement
  hearts: HTMLElement
  bubble: HTMLElement
  needs: Record<NeedType, HTMLButtonElement | null>
  pettables: HTMLElement[]
}

let baseState: BaseState = 'idle'
let transientTimer: ReturnType<typeof setTimeout> | null = null
let bounceTimer: ReturnType<typeof setTimeout> | null = null
let bubbleTimer: ReturnType<typeof setTimeout> | null = null
let blinkTimer: ReturnType<typeof setInterval> | null = null
let isBlinking = false
let nextBlinkAt = 0
let blinkEndsAt = 0
let isViewBusy = false

export function collectPetView(): PetViewElements | null {
  const plant = document.getElementById('plant')
  const img = document.getElementById('pet-img') as HTMLImageElement | null
  const hearts = document.getElementById('hearts')
  const bubble = document.getElementById('bubble')
  const pettables = Array.from(document.querySelectorAll<HTMLElement>('.pettable'))
  if (!plant || !img || !hearts || !bubble || pettables.length === 0) {
    return null
  }
  return {
    plant,
    img,
    hearts,
    bubble,
    needs: {
      water: document.getElementById('need-water') as HTMLButtonElement | null,
      sun: document.getElementById('need-sun') as HTMLButtonElement | null,
    },
    pettables,
  }
}

function cancelTransient(): void {
  transientVersion += 1
  if (transientTimer !== null) clearTimeout(transientTimer)
  transientTimer = null
  resolveTransient?.()
  resolveTransient = null
  isViewBusy = false
}

function applyFrame(view: PetViewElements, name: FrameName): void {
  view.img.src = frameOf(name)
}

export function setBaseState(view: PetViewElements, state: BaseState): void {
  baseState = state
  if (isUnadopted || isViewBusy) {
    return
  }
  applyFrame(view, state)
}

export async function flashFrame(
  view: PetViewElements,
  name: FrameName,
  holdMs: number,
): Promise<void> {
  if (isUnadopted) {
    return
  }
  cancelTransient()
  const version = transientVersion
  isViewBusy = true
  applyFrame(view, name)
  await new Promise<void>((resolve) => {
    resolveTransient = resolve
    transientTimer = setTimeout(resolve, holdMs)
  })
  if (version !== transientVersion || isUnadopted) return
  transientTimer = null
  resolveTransient = null
  isViewBusy = false
  applyFrame(view, baseState)
}

export function flashBounce(view: PetViewElements): void {
  view.plant.classList.remove('bounce')
  void view.plant.offsetWidth
  view.plant.classList.add('bounce')
  if (bounceTimer !== null) {
    clearTimeout(bounceTimer)
  }
  bounceTimer = setTimeout(() => {
    view.plant.classList.remove('bounce')
    bounceTimer = null
  }, BOUNCE_HOLD_MS)
}

export function setSunning(view: PetViewElements, on: boolean): void {
  view.plant.classList.toggle('sunning', on)
}

export function setNeedDue(view: PetViewElements, type: NeedType, isDue: boolean): void {
  view.needs[type]?.classList.toggle('show', isDue)
}

export function applyStage(view: PetViewElements, stageIndex: number): void {
  const stage = STAGE_CODES[stageIndex] ?? 'juvenile'
  if (stage !== currentStage) cancelTransient()
  currentStage = stage
  view.plant.style.setProperty('--stage-scale', '1')
  if (!isUnadopted && !isViewBusy) applyFrame(view, baseState)
}

export function applySpeciesHue(view: PetViewElements, hue: number): void {
  view.plant.style.setProperty('--species-hue', `${hue}deg`)
}

export function showBubble(view: PetViewElements, text: string): void {
  view.bubble.textContent = text
  view.bubble.classList.add('show')
  if (bubbleTimer !== null) {
    clearTimeout(bubbleTimer)
  }
  bubbleTimer = setTimeout(() => {
    view.bubble.classList.remove('show')
    bubbleTimer = null
  }, BUBBLE_HOLD_MS)
}

export function spawnHearts(view: PetViewElements, count: number): void {
  if (view.hearts.children.length >= MAX_HEARTS) {
    return
  }
  for (let i = 0; i < count; i++) {
    const heart = document.createElement('span')
    heart.className = 'heart'
    heart.textContent = Math.random() > 0.4 ? '❤' : '💚'
    heart.style.left = `${64 + Math.random() * 80}px`
    heart.style.top = `${50 + Math.random() * 40}px`
    heart.addEventListener('animationend', () => heart.remove())
    view.hearts.appendChild(heart)
  }
}

function tickBlink(view: PetViewElements): void {
  const now = Date.now()
  if (isBlinking && now >= blinkEndsAt) {
    isBlinking = false
    nextBlinkAt = now + 2800 + Math.random() * 2400
    if (!isViewBusy && baseState === 'idle' && !isUnadopted) applyFrame(view, 'idle')
    return
  }
  if (!isBlinking && now >= nextBlinkAt && !isViewBusy && baseState === 'idle' && !isUnadopted) {
    isBlinking = true
    blinkEndsAt = now + BLINK_HOLD_MS
    applyFrame(view, 'sleep')
  }
}

export function startBlink(view: PetViewElements): void {
  if (blinkTimer !== null || isUnadopted) return
  nextBlinkAt = Date.now() + 4000
  // 单个托管时钟驱动闭眼与恢复，不在定时回调中再次注册定时器。
  blinkTimer = setInterval(() => tickBlink(view), BLINK_HOLD_MS)
}

export function disposeViewTimers(): void {
  cancelTransient()
  if (bounceTimer !== null) clearTimeout(bounceTimer)
  if (bubbleTimer !== null) clearTimeout(bubbleTimer)
  if (blinkTimer !== null) clearInterval(blinkTimer)
  bounceTimer = null
  bubbleTimer = null
  blinkTimer = null
  isBlinking = false
}
