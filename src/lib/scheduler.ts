import { emit } from '@tauri-apps/api/event'
import {
  createTask,
  getLastCompletedAt,
  getOpenTask,
  getPlant,
  listOpenTasks,
  markOverdue,
  markReminded,
  SUN_INTERVAL_H,
  WATER_INTERVAL_H,
} from './database'
import type { CareTask, CareTaskType, Plant } from './database'
import { SPECIES } from '../config/species'
import { readSettings } from './capabilities'

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

function isPaused(settings: { pausedUntil: number | null }, now = Date.now()): boolean {
  return settings.pausedUntil !== null && now < settings.pausedUntil
}

function intervalMsOf(type: CareTaskType): number {
  const hours = type === 'water' ? WATER_INTERVAL_H : SUN_INTERVAL_H
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
      : lastCompletedAt + intervalMsOf(type)
    await createTask(plant.id, type, Math.max(scheduledAt, now + MIN_NEXT_DELAY_MS))
    open = await getOpenTask(plant.id, type)
  }
  if (!open) {
    return
  }
  if (open.status === 'pending' && open.scheduled_at <= now) {
    await markReminded(open.id)
    const settings = await readSettings()
    callbacks?.onRemind({ ...open, status: 'reminded' }, plant, isPaused(settings))
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
