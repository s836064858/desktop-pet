import { getCurrentWindow } from '@tauri-apps/api/window'
import { PhysicalSize } from '@tauri-apps/api/dpi'
import { emit, listen } from '@tauri-apps/api/event'
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
import {
  completeTask,
  ensureSchema,
  getOpenTask,
  getPlant,
  getRecentCareFeedback,
} from './lib/database'
import { getGrowthSnapshot, recordDailyInteraction } from './lib/growthRepository'
import { getGrowthStage } from './lib/growth'
import type { CareTaskType, Plant } from './lib/database'
import { SPECIES } from './config/species'
import { disposeScheduler, invalidatePlant, notifyChanged, startScheduler } from './lib/scheduler'
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
import { disposeSpeciesUrls, loadCustomSpeciesFrameUrls } from './lib/spriteLibrary'
import type { BaseState, NeedType, PetViewElements } from './lib/petView'

const SAVE_DELAY_MS = 400
const STROKE_STEP_PX = 8
const STROKE_TURNS = 2
const STROKE_HEART_COUNT = 3
const CLICK_SUPPRESS_MS = 400
const MILESTONE_STEP = 10
const HAPPY_HOLD_MS = 1600
// 尺寸抖动的保持时长；首抖在启动末尾，第二抖覆盖首帧绘制稍晚发生的时序抖动
const REPAINT_NUDGE_HOLD_MS = 80
const REPAINT_NUDGE_AGAIN_MS = 1500

const POKE_LINES = ['别戳啦~', '痒！', '嗯？', '晃得我头晕', '再看就把你喝掉', '咋啦？']
const PET_LINES = ['好舒服~', '叶子亮了', '继续继续', '沙沙沙…', '开心！']
const REMIND_LINES: Record<CareTaskType, string> = {
  water: '该浇水啦，点💧照护',
  sun: '给它补充光照，点☀️',
}
const ADOPT_HINT = '先到面板领养一株植物吧（托盘 → 显示面板）'
const TIP_DEFAULT = '摸摸我 · 悬浮养护 · 拖花盆搬家'
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
let unlistenConsole: (() => void) | null = null
let affection = 0
let clickSuppressedUntil = 0
let isCaring = false
let isRecordingInteraction = false
let stageIndex = 0
let currentBaseState: BaseState = 'idle'
let unlistenPlantChanged: (() => void) | null = null
let unlistenCareChanged: (() => void) | null = null
let plantVersion = 0
let stageVersion = 0
let isDisposed = false
let repaintTimer: ReturnType<typeof setTimeout> | null = null
let lastFeedbackTaskId = 0
let renderedPlantId: number | null = null
let nudgeHoldTimer: ReturnType<typeof setTimeout> | null = null
let resolveNudge: (() => void) | null = null
let view: PetViewElements | null = null
let petContextMenu: Menu | null = null
const stroke: StrokeState = {
  isActive: false,
  lastX: 0,
  direction: 0,
  turns: 0,
  isTriggered: false,
}
const resourcesController = new AbortController()

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
  void recordPetInteraction()
}

function triggerPoked(): void {
  if (!view) {
    return
  }
  flashBounce(view)
  showBubble(view, isUnadoptedView() ? ADOPT_HINT : pickRandom(POKE_LINES))
  if (!isUnadoptedView()) void recordPetInteraction()
}

async function recordPetInteraction(): Promise<void> {
  if (isRecordingInteraction || isDisposed || renderedPlantId === null) return
  const plantId = renderedPlantId
  const version = plantVersion
  isRecordingInteraction = true
  try {
    const { hasGrown } = await recordDailyInteraction({ plantId })
    if (!view || isDisposed || version !== plantVersion) return
    if (hasGrown) showBubble(view, '今天的陪伴已记下，成长 +1 日 🌱')
    await emit('care-changed')
  } catch {
    if (view && !isDisposed && version === plantVersion) {
      showBubble(view, '陪伴记录未保存，再摸摸我可以重试。')
    }
  } finally {
    isRecordingInteraction = false
  }
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
  const version = ++stageVersion
  const plant = await getPlant()
  if (!view || isDisposed) return
  if (!plant) {
    if (renderedPlantId !== null) enterUnadoptedView()
    return
  }
  if (renderedPlantId !== plant.id) {
    await onPlantChanged()
    return
  }
  const growth = await getGrowthSnapshot(plant.id)
  const feedback = await getRecentCareFeedback(plant.id)
  if (version !== stageVersion || isDisposed || !view) return
  const stage = getGrowthStage(growth.previewDays ?? growth.days)
  if (growth.previewDays === null && stage.index > stageIndex) {
    showBubble(view, `升级！进入${stage.name} 🌿`)
    spawnHearts(view, STROKE_HEART_COUNT)
  }
  stageIndex = stage.index
  applyStage(view, stage.index)
  setBaseState(view, currentBaseState)
  if (feedback && feedback.taskId !== lastFeedbackTaskId) {
    lastFeedbackTaskId = feedback.taskId
    const frame = feedback.type === 'water' ? 'water' : 'sun'
    void flashFrame(view, frame, 1700)
    showBubble(view, '照护已记下，谢谢你的陪伴！')
  }
}

async function runCare(type: NeedType): Promise<void> {
  if (!view || isCaring || isUnadoptedView()) return
  isCaring = true
  try {
    await completePetCare({ type, version: plantVersion })
  } catch {
    if (view && !isDisposed) showBubble(view, '养护未完成，请稍后重试或打开面板。')
  } finally {
    isCaring = false
    notifyChanged()
  }
}

async function completePetCare(input: { type: NeedType; version: number }): Promise<void> {
  const plant = await getPlant()
  if (!plant || isDisposed || input.version !== plantVersion) return
  const task = await getOpenTask(plant.id, input.type)
  if (!view || isDisposed || input.version !== plantVersion) return
  if (!task) {
    const { hasGrown } = await recordDailyInteraction({ plantId: plant.id })
    if (!view || isDisposed || input.version !== plantVersion) return
    incrementAffection()
    showBubble(
      view,
      hasGrown ? '今天的陪伴已记下，成长 +1 日 🌱' : '刚刚照护过啦，摸摸我也很开心。',
    )
    void flashFrame(view, 'happy', HAPPY_HOLD_MS)
    await emit('care-changed')
    return
  }
  const result = await completeTask({ task })
  if (!view || isDisposed || input.version !== plantVersion) return
  incrementAffection()
  showBubble(view, `${input.type === 'water' ? '浇水' : '光照'}完成，+${result.points} 积分！`)
  await emit('care-changed')
}

function onWaterClick(): void {
  void runCare('water')
}
function onLightClick(): void {
  void runCare('sun')
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
    void sendTaskNotification(`该浇水啦 · ${nickname}`, `到了这轮浇水时间，点 💧 完成照护。`)
  } else {
    void sendTaskNotification(`该补充光照啦 · ${nickname}`, `到了这轮光照时间，点 ☀️ 完成照护。`)
  }
  showBubble(view, REMIND_LINES[task.type])
  void info(`[pet] 提醒已发出：${task.type}`)
}

function onDueChange(state: DueState): void {
  currentBaseState = state.water ? 'thirsty' : 'idle'
  if (!view) {
    return
  }
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
  renderedPlantId = null
  stageIndex = 0
  setAdoptedChrome(false)
}

async function onPlantChanged(): Promise<void> {
  const version = ++plantVersion
  stageVersion += 1
  if (!view) {
    invalidatePlant()
    return
  }
  const plant = await getPlant()
  if (version !== plantVersion || isDisposed) return
  if (!plant) {
    invalidatePlant()
    enterUnadoptedView()
    showBubble(view, ADOPT_HINT)
    return
  }
  await ensureSpeciesArt(plant.species_code)
  if (version !== plantVersion || isDisposed) return
  applyAdoptedPlantView(plant)
  invalidatePlant()
  notifyChanged()
  await syncStage()
  if (version !== plantVersion || isDisposed) return
  showBubble(view, `${plant.nickname} 来啦！`)
  await info(`[pet] 植物已切换：${plant.nickname}（${plant.species_code}）`)
}

function applyAdoptedPlantView(plant: Plant): void {
  if (!view || isDisposed) return
  renderedPlantId = plant.id
  stageIndex = 0
  currentBaseState = 'idle'
  setSpeciesFrames(plant.species_code)
  applySpeciesHue(view, hasSpeciesArt(plant.species_code) ? 0 : hueOfPlant(plant))
  setUnadopted(view, false)
  setAdoptedChrome(true)
  setNeedDue(view, 'water', false)
  setNeedDue(view, 'sun', false)
  setBaseState(view, currentBaseState)
  startBlink(view)
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

function disposeLocalTimers(): void {
  if (repaintTimer !== null) clearTimeout(repaintTimer)
  if (nudgeHoldTimer !== null) clearTimeout(nudgeHoldTimer)
  if (saveTimer !== null) clearTimeout(saveTimer)
  repaintTimer = null
  nudgeHoldTimer = null
  saveTimer = null
  resolveNudge?.()
  resolveNudge = null
}

function cleanup(): void {
  isDisposed = true
  resourcesController.abort()
  plantVersion += 1
  stageVersion += 1
  disposeLocalTimers()
  unlistenConsole?.()
  unlistenCareChanged?.()
  unlistenPlantChanged?.()
  unlistenMoved?.()
  unlistenConsole = unlistenCareChanged = unlistenPlantChanged = unlistenMoved = null
  view?.needs.water?.removeEventListener('click', onWaterClick)
  view?.needs.sun?.removeEventListener('click', onLightClick)
  window.removeEventListener('pagehide', cleanup)
  disposeViewTimers()
  disposeSpeciesUrls()
  disposeScheduler()
  teardownGestures()
}

function registerViewEvents(): void {
  if (!view) return
  initGestures()
  view.needs.water?.addEventListener('click', onWaterClick)
  view.needs.sun?.addEventListener('click', onLightClick)
}

async function initializePlantView(): Promise<void> {
  const plant = await getPlant()
  if (isDisposed || !view) return
  if (plant) {
    await ensureSpeciesArt(plant.species_code)
    applyAdoptedPlantView(plant)
  } else {
    enterUnadoptedView()
    showBubble(view, ADOPT_HINT)
  }
  await syncStage()
  if (isDisposed || !view) return
  setBaseState(view, currentBaseState)
  startBlink(view)
}

function onPlantWindowEvent(): void {
  void onPlantChanged().catch(() => info('[pet] 植物切换失败，请重新打开应用。'))
}

function onCareWindowEvent(): void {
  void syncStage().catch(() => info('[pet] 成长同步失败，下轮重试。'))
}

async function connectWindowEvents(): Promise<void> {
  const stopPlant = await listen('plant-changed', onPlantWindowEvent)
  if (isDisposed) return stopPlant()
  unlistenPlantChanged = stopPlant
  const stopCare = await listen('care-changed', onCareWindowEvent)
  if (isDisposed) return stopCare()
  unlistenCareChanged = stopCare
  const stopMoved = await appWindow.onMoved((event) =>
    scheduleSave(event.payload.x, event.payload.y),
  )
  if (isDisposed) return stopMoved()
  unlistenMoved = stopMoved
}

function scheduleRepaint(): void {
  if (isDisposed) return
  void nudgeRepaint()
  repaintTimer = setTimeout(() => {
    repaintTimer = null
    void nudgeRepaint()
  }, REPAINT_NUDGE_AGAIN_MS)
}

async function start(): Promise<void> {
  const stopConsole = await attachConsole()
  if (isDisposed) return stopConsole()
  unlistenConsole = stopConsole
  const isRestored = await restorePetPosition(appWindow)
  if (isDisposed) return
  affection = await readAffection()
  if (isDisposed) return
  view = collectPetView()
  if (!view) {
    stopConsole()
    return
  }
  registerViewEvents()
  await ensureSchema()
  await initializePlantView()
  if (isDisposed) return
  await connectWindowEvents()
  if (isDisposed) return
  await startScheduler({ onRemind, onDueChange })
  scheduleRepaint()
  await info(`[pet] 宠物窗就绪：${isRestored ? '恢复位置' : '首次启动'}，好感度 ${affection}`)
}

function hueOfPlant(plant: Plant): number {
  return SPECIES[plant.species_code]?.hue ?? 0
}

// macOS WKWebView 透明窗偶现首帧不绘制（tauri#8255，官方未修，shadow:false 只压了一部分）：
// 1px 尺寸抖动强制重排重绘，与「重新领养后恢复显示」同一条自愈路径，仅启动时兜底
async function nudgeRepaint(): Promise<void> {
  if (!view || isDisposed || !navigator.userAgent.includes('Mac')) {
    return
  }
  try {
    const size = await appWindow.outerSize()
    if (isDisposed) return
    await appWindow.setSize(new PhysicalSize(size.width + 1, size.height))
    if (isDisposed) return
    await new Promise<void>((resolve) => {
      resolveNudge = resolve
      nudgeHoldTimer = setTimeout(resolve, REPAINT_NUDGE_HOLD_MS)
    })
    nudgeHoldTimer = null
    resolveNudge = null
    if (isDisposed) return
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
    const frames = await loadCustomSpeciesFrameUrls(code, resourcesController.signal)
    if (isDisposed) return
    if (Object.keys(frames).length > 0) {
      registerCustomSpeciesFrames(code, frames)
      registeredCustom.add(code)
      await info(`[pet] 已加载自定义物种帧：${code}`)
    }
  } catch (err) {
    await info(`[pet] 自定义物种帧加载失败（走色相回退）：${String(err)}`)
  }
}

window.addEventListener('pagehide', cleanup)
start().catch(async () => {
  if (view && !isDisposed) showBubble(view, '初始化失败，请退出并重新打开应用。')
  cleanup()
  await info('[pet] 初始化失败，请重新启动应用。')
})
