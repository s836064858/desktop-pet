import { getSpeciesFrame, hasSpeciesArt } from './speciesArt'
import type { FrameName } from './speciesArt'

export type NeedType = 'water' | 'sun'
export type BaseState = 'idle' | 'thirsty'

const FALLBACK_SPECIES = 'pothos'

let currentSpecies = FALLBACK_SPECIES

export function setSpeciesFrames(speciesCode: string): void {
  currentSpecies = hasSpeciesArt(speciesCode) ? speciesCode : FALLBACK_SPECIES
}

function frameOf(name: FrameName): string {
  const frame = getSpeciesFrame(currentSpecies, name) ?? getSpeciesFrame(FALLBACK_SPECIES, name)
  if (!frame) {
    throw new Error(`缺少帧资源：${currentSpecies}/${name}`)
  }
  return frame
}

const BUBBLE_HOLD_MS = 1900
const BOUNCE_HOLD_MS = 550
const BLINK_HOLD_MS = 130
const STAGE_SCALES = [1, 1.08]
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
let blinkTimer: ReturnType<typeof setTimeout> | null = null
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

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function applyFrame(view: PetViewElements, name: FrameName): void {
  view.img.src = frameOf(name)
}

export function setBaseState(view: PetViewElements, state: BaseState): void {
  baseState = state
  if (!isViewBusy) {
    applyFrame(view, state)
  }
}

export async function flashFrame(view: PetViewElements, name: FrameName, holdMs: number): Promise<void> {
  isViewBusy = true
  applyFrame(view, name)
  if (transientTimer !== null) {
    clearTimeout(transientTimer)
  }
  await wait(holdMs)
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
  const scale = STAGE_SCALES[stageIndex] ?? 1
  view.plant.style.setProperty('--stage-scale', String(scale))
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

function scheduleBlink(view: PetViewElements): void {
  const delay = 2800 + Math.random() * 2400
  blinkTimer = setTimeout(() => {
    if (!isViewBusy && baseState === 'idle') {
      applyFrame(view, 'sleep')
      setTimeout(() => {
        if (!isViewBusy && baseState === 'idle') {
          applyFrame(view, 'idle')
        }
        scheduleBlink(view)
      }, BLINK_HOLD_MS)
      return
    }
    scheduleBlink(view)
  }, delay)
}

export function startBlink(view: PetViewElements): void {
  if (blinkTimer !== null) {
    return
  }
  scheduleBlink(view)
}

export function disposeViewTimers(): void {
  if (transientTimer !== null) {
    clearTimeout(transientTimer)
    transientTimer = null
  }
  if (bounceTimer !== null) {
    clearTimeout(bounceTimer)
    bounceTimer = null
  }
  if (bubbleTimer !== null) {
    clearTimeout(bubbleTimer)
    bubbleTimer = null
  }
  if (blinkTimer !== null) {
    clearTimeout(blinkTimer)
    blinkTimer = null
  }
  isViewBusy = false
}
