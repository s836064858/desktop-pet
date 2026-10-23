import { getCurrentWindow } from '@tauri-apps/api/window'
import { PhysicalSize } from '@tauri-apps/api/dpi'
import { listen } from '@tauri-apps/api/event'
import { Menu } from '@tauri-apps/api/menu'
import { exit } from '@tauri-apps/plugin-process'
import { attachConsole, info } from '@tauri-apps/plugin-log'
import {
  readAffection,
  restorePetPosition,
  saveAffection,
  savePetPosition,
  sendTaskNotification,
  showPanelWindow,
} from './lib/capabilities'
import { completeTask, ensureSchema, getPlant, getStageFromCount, getTotalCompletedCount } from './lib/database'
import type { CareResult, CareTaskType, Plant } from './lib/database'
import { SPECIES } from './config/species'
import { disposeScheduler, getOpenTaskInfo, invalidatePlant, notifyChanged, startScheduler } from './lib/scheduler'
import type { DueState } from './lib/scheduler'
import {
  applySpeciesHue,
  applyStage,
  collectPetView,
  disposeViewTimers,
  flashBounce,
  flashFrame,
  isUnadoptedView,
  setBaseState,
  setNeedDue,
  setSpeciesFrames,
  setSunning,
  setUnadopted,
  showBubble,
  spawnHearts,
  startBlink,
} from './lib/petView'
import { hasSpeciesArt, registerCustomSpeciesFrames } from './lib/speciesArt'
import { loadCustomSpeciesFrameUrls } from './lib/spriteLibrary'
import type { BaseState, NeedType, PetViewElements } from './lib/petView'

const SAVE_DELAY_MS = 400
const STROKE_STEP_PX = 8
const STROKE_TURNS = 2
const STROKE_HEART_COUNT = 3
const CLICK_SUPPRESS_MS = 400
const MILESTONE_STEP = 10
const HAPPY_HOLD_MS = 1600
const WATER_HOLD_MS = 1700
const SUN_HOLD_MS = 2100
// 尺寸抖动的保持时长；首抖在启动末尾，第二抖覆盖首帧绘制稍晚发生的时序抖动
const REPAINT_NUDGE_HOLD_MS = 80
const REPAINT_NUDGE_AGAIN_MS = 1500

const POKE_LINES = ['别戳啦~', '痒！', '嗯？', '晃得我头晕', '再看就把你喝掉', '咋啦？']
const PET_LINES = ['好舒服~', '叶子亮了', '继续继续', '沙沙沙…', '开心！']
const REMIND_LINES: Record<CareTaskType, string> = {
  water: '我渴了，点💧浇水',
  sun: '想晒太阳，点☀️',
}
const CARE_DONE_LINES: Record<CareTaskType, string> = {
  water: '咕嘟咕嘟~ 谢谢！',
  sun: '晒满能量啦！',
}
const CARE_FUN_LINES: Record<CareTaskType, string> = {
  water: '已经水润润啦，别涝着~',
  sun: '刚晒过呢，休息一下~',
}
const DAILY_CAP_NOTE = '（今日积分已达上限 20）'
const ADOPT_HINT = '先到面板领养一株植物吧（托盘 → 显示面板）'
const TIP_DEFAULT = '摸摸我 · 悬浮浇水 · 拖花盆搬家'
const TIP_UNADOPTED = '摸摸我 · 拖花盆搬家 · 去面板领养一株植物'

interface StrokeState {
  isActive: boolean
  lastX: number
  direction: number
  turns: number
  isTriggered: boolean
}

const appWindow = getCurrentWindow()

let saveTimer: ReturnType<typeof setTimeout> | null = null
let unlistenMoved: (() => void) | null = null
let affection = 0
let clickSuppressedUntil = 0
let isCaring = false
let stageIndex = 0
let currentBaseState: BaseState = 'idle'
let unlistenPlantChanged: (() => void) | null = null
let view: PetViewElements | null = null
let petContextMenu: Menu | null = null
const stroke: StrokeState = { isActive: false, lastX: 0, direction: 0, turns: 0, isTriggered: false }

function pickRandom(lines: string[]): string {
  return lines[Math.floor(Math.random() * lines.length)]
}

function incrementAffection(): void {
  affection += 1
  void saveAffection(affection)
}

function triggerPetted(): void {
  if (!view) {
    return
  }
  if (isUnadoptedView()) {
    flashBounce(view)
    showBubble(view, ADOPT_HINT)
    return
  }
  incrementAffection()
  void info(`[pet] 抚摸 +1，好感度 ${affection}`)
  clickSuppressedUntil = Date.now() + CLICK_SUPPRESS_MS
  void flashFrame(view, 'happy', HAPPY_HOLD_MS)
  spawnHearts(view, STROKE_HEART_COUNT)
  const isMilestone = affection % MILESTONE_STEP === 0
  showBubble(view, isMilestone ? `好感度 ${affection} ❤❤` : pickRandom(PET_LINES))
}

function triggerPoked(): void {
  if (!view) {
    return
  }
  flashBounce(view)
  showBubble(view, isUnadoptedView() ? ADOPT_HINT : pickRandom(POKE_LINES))
}

function onPettablePointerDown(event: PointerEvent): void {
  if (event.button !== 0) {
    return
  }
  stroke.isActive = true
  stroke.lastX = event.clientX
  stroke.direction = 0
  stroke.turns = 0
  stroke.isTriggered = false
}

function onWindowPointerMove(event: PointerEvent): void {
  if (!stroke.isActive || stroke.isTriggered) {
    return
  }
  const dx = event.clientX - stroke.lastX
  if (Math.abs(dx) < STROKE_STEP_PX) {
    return
  }
  const direction = Math.sign(dx)
  if (stroke.direction !== 0 && direction !== stroke.direction) {
    stroke.turns += 1
  }
  stroke.direction = direction
  stroke.lastX = event.clientX
  if (stroke.turns >= STROKE_TURNS) {
    stroke.isTriggered = true
    triggerPetted()
  }
}

function onWindowPointerUp(): void {
  stroke.isActive = false
}

function onPettableClick(): void {
  if (Date.now() < clickSuppressedUntil) {
    return
  }
  triggerPoked()
}

async function ensurePetContextMenu(): Promise<Menu> {
  if (petContextMenu === null) {
    petContextMenu = await Menu.new({
      items: [
        {
          id: 'show-panel',
          text: '显示面板',
          action: () => {
            void showPanelWindow()
          },
        },
        { item: 'Separator' },
        {
          id: 'quit',
          text: '退出',
          action: () => {
            void exit(0)
          },
        },
      ],
    })
  }
  return petContextMenu
}

function onWindowContextMenu(event: MouseEvent): void {
  event.preventDefault()
  void ensurePetContextMenu().then((menu) => menu.popup())
}

function initGestures(): void {
  if (!view) {
    return
  }
  for (const el of view.pettables) {
    el.addEventListener('pointerdown', onPettablePointerDown)
    el.addEventListener('click', onPettableClick)
  }
  window.addEventListener('pointermove', onWindowPointerMove)
  window.addEventListener('pointerup', onWindowPointerUp)
  window.addEventListener('contextmenu', onWindowContextMenu)
}

function teardownGestures(): void {
  if (!view) {
    return
  }
  for (const el of view.pettables) {
    el.removeEventListener('pointerdown', onPettablePointerDown)
    el.removeEventListener('click', onPettableClick)
  }
  window.removeEventListener('pointermove', onWindowPointerMove)
  window.removeEventListener('pointerup', onWindowPointerUp)
  window.removeEventListener('contextmenu', onWindowContextMenu)
}

async function syncStage(): Promise<void> {
  if (!view) {
    return
  }
  const count = await getTotalCompletedCount()
  const stage = getStageFromCount(count)
  if (stage.index > stageIndex) {
    showBubble(view, `升级！进入${stage.name} 🌿`)
    spawnHearts(view, STROKE_HEART_COUNT)
  }
  stageIndex = stage.index
  applyStage(view, stage.index)
}

function buildCareBubble(type: CareTaskType, result: CareResult): string {
  const base = CARE_DONE_LINES[type]
  if (result.points <= 0) {
    return `${base} 今日积分已满 ❤`
  }
  const prefix = result.isEarly ? '提前照顾好勤快！' : result.isLate ? '补做也算数！' : ''
  const capNote = result.points < result.basePoints ? DAILY_CAP_NOTE : ''
  return `${prefix}${base} +${result.points} 积分${capNote}`
}

async function runCare(type: NeedType): Promise<void> {
  if (!view || isCaring || isUnadoptedView()) {
    return
  }
  const open = await getOpenTaskInfo(type)
  if (!open) {
    incrementAffection()
    void flashFrame(view, 'happy', HAPPY_HOLD_MS)
    showBubble(view, CARE_FUN_LINES[type])
    return
  }
  isCaring = true
  setNeedDue(view, type, false)
  try {
    if (type === 'water') {
      await flashFrame(view, 'water', WATER_HOLD_MS)
    } else {
      setSunning(view, true)
      await flashFrame(view, 'sun', SUN_HOLD_MS)
      setSunning(view, false)
    }
    const result = await completeTask(open.task)
    incrementAffection()
    void flashFrame(view, 'happy', HAPPY_HOLD_MS)
    spawnHearts(view, STROKE_HEART_COUNT)
    showBubble(view, buildCareBubble(type, result))
    await syncStage()
    void info(`[pet] ${type} 任务完成：+${result.points}/${result.basePoints} 积分（${result.isEarly ? '提前' : result.isLate ? '补做' : '按时'}）`)
  } catch (err) {
    showBubble(view, '哎呀，出错了…')
    void info(`[pet] ${type} 任务完成失败：${String(err)}`)
  } finally {
    isCaring = false
    notifyChanged()
  }
}

function onRemind(task: { type: CareTaskType }, plant: Plant, isSilent: boolean): void {
  if (!view) {
    return
  }
  const nickname = plant.nickname
  if (isSilent) {
    void info(`[pet] 暂停期静默提醒：${task.type}`)
    return
  }
  if (task.type === 'water') {
    void sendTaskNotification(`该浇水啦 · ${nickname}`, `${nickname} 渴了，悬浮到它头顶点 💧`)
  } else {
    void sendTaskNotification(`该晒太阳啦 · ${nickname}`, `${nickname} 想晒太阳，悬浮到它头顶点 ☀️`)
  }
  showBubble(view, REMIND_LINES[task.type])
  void info(`[pet] 提醒已发出：${task.type}`)
}

function onDueChange(state: DueState): void {
  if (!view) {
    return
  }
  currentBaseState = state.water ? 'thirsty' : 'idle'
  setNeedDue(view, 'water', state.water)
  setNeedDue(view, 'sun', state.sun)
  setBaseState(view, currentBaseState)
  void info(`[pet] 需求状态：water=${state.water}, sun=${state.sun}, overdue=${state.hasOverdue}`)
}

// 未领养态的窗口 chrome：隐藏浇水/晒太阳按钮、底部队列文案换成领养引导（pet.html 按 body.unadopted 生效）
function setAdoptedChrome(adopted: boolean): void {
  document.body.classList.toggle('unadopted', !adopted)
  const tip = document.getElementById('tip')
  if (tip) {
    tip.textContent = adopted ? TIP_DEFAULT : TIP_UNADOPTED
  }
}

function enterUnadoptedView(): void {
  if (!view) {
    return
  }
  setUnadopted(view, true)
  stageIndex = 0
  setAdoptedChrome(false)
}

async function onPlantChanged(): Promise<void> {
  if (!view) {
    invalidatePlant()
    return
  }
  const plant = await getPlant()
  if (!plant) {
    invalidatePlant()
    enterUnadoptedView()
    showBubble(view, ADOPT_HINT)
    return
  }
  await ensureSpeciesArt(plant.species_code)
  setSpeciesFrames(plant.species_code)
  applySpeciesHue(view, hasSpeciesArt(plant.species_code) ? 0 : hueOfPlant(plant))
  setUnadopted(view, false)
  setAdoptedChrome(true)
  setBaseState(view, currentBaseState)
  startBlink(view)
  invalidatePlant()
  notifyChanged()
  showBubble(view, `${plant.nickname} 来啦！`)
  await info(`[pet] 植物已切换：${plant.nickname}（${plant.species_code}）`)
}

async function persistPosition(x: number, y: number): Promise<void> {
  await savePetPosition([x, y])
  await info(`[pet] 位置已保存：x=${x}, y=${y}`)
}

function scheduleSave(x: number, y: number): void {
  if (saveTimer !== null) {
    clearTimeout(saveTimer)
  }
  saveTimer = setTimeout(() => {
    void persistPosition(x, y)
  }, SAVE_DELAY_MS)
}

function cleanup(): void {
  if (saveTimer !== null) {
    clearTimeout(saveTimer)
    saveTimer = null
  }
  if (unlistenMoved) {
    unlistenMoved()
    unlistenMoved = null
  }
  if (unlistenPlantChanged) {
    unlistenPlantChanged()
    unlistenPlantChanged = null
  }
  disposeViewTimers()
  disposeScheduler()
  teardownGestures()
}

async function start() {
  await attachConsole()
  const isRestored = await restorePetPosition(appWindow)
  affection = await readAffection()

  view = collectPetView()
  if (!view) {
    await info('[pet] 缺少交互元素，宠物功能跳过')
    return
  }
  initGestures()
  view.needs.water?.addEventListener('click', () => {
    void runCare('water')
  })
  view.needs.sun?.addEventListener('click', () => {
    void runCare('sun')
  })
  window.addEventListener('pagehide', cleanup)

  await ensureSchema()
  const plant = await getPlant()
  if (plant) {
    await ensureSpeciesArt(plant.species_code)
    setSpeciesFrames(plant.species_code)
    if (!hasSpeciesArt(plant.species_code)) {
      applySpeciesHue(view, hueOfPlant(plant))
    }
    setAdoptedChrome(true)
  } else {
    enterUnadoptedView()
  }
  await syncStage()
  setBaseState(view, 'idle')
  startBlink(view)
  await startScheduler({ onRemind, onDueChange })
  unlistenPlantChanged = await listen('plant-changed', () => {
    void onPlantChanged()
  })
  if (!plant) {
    showBubble(view, ADOPT_HINT)
  }
  await info(`[pet] 宠物窗就绪：${isRestored ? '已恢复上次位置' : '首次启动'}，好感度 ${affection}，调度器已启动`)
  void nudgeRepaint()
  setTimeout(() => void nudgeRepaint(), REPAINT_NUDGE_AGAIN_MS)
  unlistenMoved = await appWindow.onMoved((event) => {
    scheduleSave(event.payload.x, event.payload.y)
  })
}

function hueOfPlant(plant: Plant): number {
  return SPECIES[plant.species_code]?.hue ?? 0
}

// macOS WKWebView 透明窗偶现首帧不绘制（tauri#8255，官方未修，shadow:false 只压了一部分）：
// 1px 尺寸抖动强制重排重绘，与「重新领养后恢复显示」同一条自愈路径，仅启动时兜底
async function nudgeRepaint(): Promise<void> {
  if (!view || !navigator.userAgent.includes('Mac')) {
    return
  }
  try {
    const size = await appWindow.outerSize()
    await appWindow.setSize(new PhysicalSize(size.width + 1, size.height))
    await new Promise((resolve) => setTimeout(resolve, REPAINT_NUDGE_HOLD_MS))
    await appWindow.setSize(new PhysicalSize(size.width, size.height))
  } catch (err) {
    await info(`[pet] 重绘抖动失败（忽略）：${String(err)}`)
  }
}

// 自定义物种（本地资源库）：首次用到时从 appData 读取帧并注册进 speciesArt
const registeredCustom = new Set<string>()
async function ensureSpeciesArt(code: string): Promise<void> {
  if (hasSpeciesArt(code) || registeredCustom.has(code)) {
    return
  }
  try {
    const frames = await loadCustomSpeciesFrameUrls(code)
    if (Object.keys(frames).length > 0) {
      registerCustomSpeciesFrames(code, frames)
      registeredCustom.add(code)
      await info(`[pet] 已加载自定义物种帧：${code}`)
    }
  } catch (err) {
    await info(`[pet] 自定义物种帧加载失败（走色相回退）：${String(err)}`)
  }
}

start().catch(async (err) => {
  await info(`[pet] 启动失败：${String(err)}`)
})
