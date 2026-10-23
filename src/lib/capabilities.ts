import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import type { Window } from '@tauri-apps/api/window'
import { PhysicalPosition } from '@tauri-apps/api/dpi'
import { disable as disableAutostart, enable as enableAutostart, isEnabled as isAutostartEnabled } from '@tauri-apps/plugin-autostart'
import { sendNotification } from '@tauri-apps/plugin-notification'
import { LazyStore } from '@tauri-apps/plugin-store'

const appStore = new LazyStore('phase0.json')
const PET_POSITION_KEY = 'pet-pos'
const AFFECTION_KEY = 'affection'
const SETTINGS_KEY = 'settings'

export interface AppSettings {
  pausedUntil: number | null
  arkApiKey: string
}

const DEFAULT_SETTINGS: AppSettings = {
  pausedUntil: null,
  arkApiKey: '',
}

export async function readSettings(): Promise<AppSettings> {
  const stored = await appStore.get<Partial<AppSettings>>(SETTINGS_KEY)
  return { ...DEFAULT_SETTINGS, ...(stored ?? {}) }
}

export async function saveSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const current = await readSettings()
  const next = { ...current, ...patch }
  await appStore.set(SETTINGS_KEY, next)
  await appStore.save()
  return next
}

export async function isAutostartOn(): Promise<boolean> {
  return isAutostartEnabled()
}

export async function setAutostart(on: boolean): Promise<void> {
  if (on) {
    await enableAutostart()
    return
  }
  await disableAutostart()
}

export async function setPetClickThrough(next: boolean): Promise<void> {
  const win = await getPetWindow()
  await win.setIgnoreCursorEvents(next)
}

async function getPetWindow(): Promise<Window> {
  const win = await WebviewWindow.getByLabel('pet')
  if (!win) {
    throw new Error('未找到 pet 窗口')
  }
  return win
}

export async function showPanelWindow(): Promise<void> {
  const win = await WebviewWindow.getByLabel('main')
  if (!win) {
    throw new Error('未找到面板窗口')
  }
  await win.show()
  await win.unminimize()
  await win.setFocus()
}

export async function savePetPosition(pos: [number, number]): Promise<void> {
  await appStore.set(PET_POSITION_KEY, pos)
  await appStore.save()
}

export async function restorePetPosition(win: Window): Promise<boolean> {
  const pos = await appStore.get<[number, number]>(PET_POSITION_KEY)
  const isValid = Array.isArray(pos) && pos.length === 2 && pos.every((n) => Number.isFinite(n))
  if (!isValid) {
    return false
  }
  await win.setPosition(new PhysicalPosition(pos[0], pos[1]))
  return true
}

export async function readAffection(): Promise<number> {
  const value = await appStore.get<number>(AFFECTION_KEY)
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

export async function saveAffection(value: number): Promise<void> {
  await appStore.set(AFFECTION_KEY, value)
  await appStore.save()
}

export async function sendTaskNotification(title: string, body: string): Promise<void> {
  await sendNotification({ title, body })
}
