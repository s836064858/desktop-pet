import { emit } from '@tauri-apps/api/event'
import { warn } from '@tauri-apps/plugin-log'
import {
  createTask,
  getLastCompletedAt,
  getOpenTask,
  getPlant,
  listOpenTasks,
  markOverdue,
  markReminded,
} from './database'
import type { CareTask, CareTaskType, Plant } from './database'
import { getGrowthSnapshot } from './growthRepository'
import type { CareProfile } from './careProfile'
import { readSettings } from './capabilities'

const TICK_MS = 15_000
const OVERDUE_AFTER_MS = 24 * 60 * 60 * 1000
const TASK_TYPES: CareTaskType[] = ['water', 'sun']

export interface DueState {
  water: boolean
  sun: boolean
  hasOverdue: boolean
}

export interface SchedulerCallbacks {
  onRemind: (task: CareTask, plant: Plant, isSilent: boolean) => void
  onDueChange: (state: DueState) => void
}

interface TickContext {
  plant: Plant
  profile: CareProfile
  startedAt: number
  version: number
}

let tickTimer: ReturnType<typeof setInterval> | null = null
let isTicking = false
let callbacks: SchedulerCallbacks | null = null
let lifecycleVersion = 0
let lastDueState: DueState | null = null

function isDue(task: CareTask): boolean {
  return task.status === 'reminded' || task.status === 'overdue'
}

function intervalMsOf(type: CareTaskType, profile: CareProfile): number {
  return (type === 'water' ? profile.waterEveryDays : profile.lightEveryDays) * 86_400_000
}

async function reconcileType(type: CareTaskType, context: TickContext): Promise<void> {
  const { plant, profile, startedAt, version } = context
  let open = await getOpenTask(plant.id, type)
  if (version !== lifecycleVersion) return
  if (!open) {
    const completedAt = await getLastCompletedAt(plant.id, type)
    if (version !== lifecycleVersion) return
    await createTask(
      plant.id,
      type,
      Math.max((completedAt ?? startedAt) + intervalMsOf(type, profile), Date.now()),
    )
    open = await getOpenTask(plant.id, type)
  }
  if (!open || version !== lifecycleVersion) return
  await updateTaskReminder(open, context)
}

async function updateTaskReminder(task: CareTask, context: TickContext): Promise<void> {
  const now = Date.now()
  if (task.status === 'pending' && task.scheduled_at <= now) {
    await markReminded(task.id)
    const settings = await readSettings()
    if (context.version !== lifecycleVersion) return
    const isSilent = settings.pausedUntil !== null && now < settings.pausedUntil
    callbacks?.onRemind({ ...task, status: 'reminded' }, context.plant, isSilent)
    return
  }
  if (task.status === 'reminded' && now >= task.scheduled_at + OVERDUE_AFTER_MS)
    await markOverdue(task.id)
}

function publishDueState(tasks: CareTask[]): void {
  const state: DueState = {
    water: tasks.some((task) => task.type === 'water' && isDue(task)),
    sun: tasks.some((task) => task.type === 'sun' && isDue(task)),
    hasOverdue: tasks.some((task) => task.status === 'overdue'),
  }
  if (
    lastDueState &&
    state.water === lastDueState.water &&
    state.sun === lastDueState.sun &&
    state.hasOverdue === lastDueState.hasOverdue
  )
    return
  lastDueState = state
  callbacks?.onDueChange(state)
}

async function reconcilePlant(version: number): Promise<void> {
  const plant = await getPlant()
  if (version !== lifecycleVersion) return
  if (!plant) return publishDueState([])
  const growth = await getGrowthSnapshot(plant.id)
  if (version !== lifecycleVersion) return
  if (!growth.profile) return publishDueState([])
  const context = { plant, profile: growth.profile, startedAt: growth.startedAt, version }
  for (const type of TASK_TYPES) {
    if (version !== lifecycleVersion) return
    await reconcileType(type, context)
  }
  const tasks = await listOpenTasks(plant.id)
  if (version === lifecycleVersion) publishDueState(tasks)
}

async function tick(): Promise<void> {
  if (isTicking || !callbacks) return
  const version = lifecycleVersion
  isTicking = true
  try {
    await reconcilePlant(version)
    if (version === lifecycleVersion) await emit('care-changed')
  } catch {
    await warn('[scheduler] 养护计划刷新失败，下一轮自动重试。')
  } finally {
    isTicking = false
  }
}

export function notifyChanged(): void {
  void tick()
}

export function invalidatePlant(): void {
  lifecycleVersion += 1
  lastDueState = null
}

export async function startScheduler(cb: SchedulerCallbacks): Promise<void> {
  disposeScheduler()
  callbacks = cb
  tickTimer = setInterval(notifyChanged, TICK_MS)
  await tick()
}

export function disposeScheduler(): void {
  lifecycleVersion += 1
  if (tickTimer !== null) clearInterval(tickTimer)
  tickTimer = null
  callbacks = null
  lastDueState = null
}
