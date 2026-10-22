import { emit } from '@tauri-apps/api/event'
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
import { SPECIES } from '../config/species'
import { readSettings } from './capabilities'
import type { AppSettings } from './capabilities'

const TICK_MS = 15_000
const OVERDUE_AFTER_MS = 24 * 60 * 60 * 1000
const MIN_NEXT_DELAY_MS = 60_000
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

export interface OpenTaskInfo {
  task: CareTask
  plant: Plant
}

let tickTimer: ReturnType<typeof setInterval> | null = null
let isTicking = false
let currentPlant: Plant | null = null
let callbacks: SchedulerCallbacks | null = null
let lastDueState: DueState | null = null

function isDue(task: CareTask): boolean {
  return task.status === 'reminded' || task.status === 'overdue'
}

function findOpenTask(tasks: CareTask[], type: CareTaskType): CareTask | undefined {
  return tasks.find((task) => task.type === type)
}

export function isQuietNow(settings: AppSettings, now = new Date()): boolean {
  if (!settings.quietEnabled) {
    return false
  }
  const toMinutes = (text: string): number => {
    const [h, m] = text.split(':').map(Number)
    return (h ?? 0) * 60 + (m ?? 0)
  }
  const current = now.getHours() * 60 + now.getMinutes()
  const start = toMinutes(settings.quietStart)
  const end = toMinutes(settings.quietEnd)
  if (start === end) {
    return false
  }
  return start < end ? current >= start && current < end : current >= start || current < end
}

function isPaused(settings: AppSettings, now = Date.now()): boolean {
  return settings.pausedUntil !== null && now < settings.pausedUntil
}

function intervalMsOf(plant: Plant, type: CareTaskType): number {
  const hours = type === 'water' ? plant.water_interval_h : plant.sun_interval_h
  return hours * 60 * 60 * 1000
}

function firstDelayMsOf(plant: Plant): number {
  const species = SPECIES[plant.species_code]
  return (species?.firstTaskDelayMin ?? 5) * 60_000
}

async function reconcileType(type: CareTaskType): Promise<void> {
  if (!currentPlant) {
    return
  }
  const plant = currentPlant
  const now = Date.now()
  let open = await getOpenTask(plant.id, type)
  if (!open) {
    const lastCompletedAt = await getLastCompletedAt(plant.id, type)
    const scheduledAt = lastCompletedAt === null
      ? now + firstDelayMsOf(plant)
      : lastCompletedAt + intervalMsOf(plant, type)
    await createTask(plant.id, type, Math.max(scheduledAt, now + MIN_NEXT_DELAY_MS))
    open = await getOpenTask(plant.id, type)
  }
  if (!open) {
    return
  }
  if (open.status === 'pending' && open.scheduled_at <= now) {
    await markReminded(open.id)
    const settings = await readSettings()
    const isSilent = isQuietNow(settings) || isPaused(settings)
    callbacks?.onRemind({ ...open, status: 'reminded' }, plant, isSilent)
  } else if (open.status === 'reminded' && now >= open.scheduled_at + OVERDUE_AFTER_MS) {
    await markOverdue(open.id)
  }
}

async function refreshDueState(): Promise<void> {
  if (!currentPlant || !callbacks) {
    return
  }
  const tasks = await listOpenTasks(currentPlant.id)
  const water = findOpenTask(tasks, 'water')
  const sun = findOpenTask(tasks, 'sun')
  const state: DueState = {
    water: water !== undefined && isDue(water),
    sun: sun !== undefined && isDue(sun),
    hasOverdue: tasks.some((task) => task.status === 'overdue'),
  }
  const isChanged = lastDueState === null
    || state.water !== lastDueState.water
    || state.sun !== lastDueState.sun
    || state.hasOverdue !== lastDueState.hasOverdue
  if (isChanged) {
    lastDueState = state
    callbacks.onDueChange(state)
  }
}

async function tick(): Promise<void> {
  if (isTicking) {
    return
  }
  isTicking = true
  try {
    if (!currentPlant) {
      currentPlant = await getPlant()
    }
    if (currentPlant) {
      for (const type of TASK_TYPES) {
        await reconcileType(type)
      }
      await refreshDueState()
    }
    await emit('care-changed')
  } finally {
    isTicking = false
  }
}

export async function getOpenTaskInfo(type: CareTaskType): Promise<OpenTaskInfo | null> {
  if (!currentPlant) {
    return null
  }
  const open = await getOpenTask(currentPlant.id, type)
  if (!open) {
    return null
  }
  return { task: open, plant: currentPlant }
}

export function notifyChanged(): void {
  void tick()
}

export function invalidatePlant(): void {
  currentPlant = null
  lastDueState = null
}

export async function startScheduler(cb: SchedulerCallbacks): Promise<void> {
  callbacks = cb
  currentPlant = await getPlant()
  await tick()
  tickTimer = setInterval(() => {
    void tick()
  }, TICK_MS)
}

export function disposeScheduler(): void {
  if (tickTimer !== null) {
    clearInterval(tickTimer)
    tickTimer = null
  }
  callbacks = null
}
