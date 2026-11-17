// 本地素材库（appData）：自定义物种的帧 PNG 与元数据注册表
// 新物种：{code}/{juvenile,adult,full}/{帧}1.png；旧物种继续读取 stage0。
import { appDataDir, join } from '@tauri-apps/api/path'
import { exists, mkdir, readFile, remove, rename, writeFile } from '@tauri-apps/plugin-fs'
import { FRAME_KEYS, GROWTH_STAGE_KEYS, hasCompleteGrowthFrames } from './spriteFrames'
import type { GrowthDescriptions, GrowthFrames, SpeciesFrames } from './spriteFrames'
import { validateCareProfile } from './careProfile'
import type { CareProfile } from './careProfile'
import { clearCustomSpeciesFrames } from './speciesArt'
import type { SpriteAnchor } from './spriteAlignment'

export interface CustomSpeciesMeta {
  code: string
  name: string
  emoji: string
  desc: string
  states: Record<string, string>
  createdAt: number
  careProfile?: CareProfile
  artVersion?: 2
  stages?: GrowthDescriptions
  alignment?: { version: 1; method?: 'automatic'; anchors: GrowthFrames<SpriteAnchor> }
}

export interface SpeciesLibrary {
  version: 1
  species: Record<string, CustomSpeciesMeta>
}

const EMPTY_LIBRARY: SpeciesLibrary = { version: 1, species: {} }
const urlCache = new Map<string, string>()
let urlGeneration = 0
let writeQueue: Promise<unknown> = Promise.resolve()

async function libraryRoot(): Promise<string> {
  return join(await appDataDir(), 'sprite-library')
}

function validateCode(code: string): void {
  if (!/^[a-z][a-z0-9-]{0,63}$/.test(code)) throw new Error('物种标识不合法。')
}

function serializeWrite<T>(operation: () => Promise<T>): Promise<T> {
  const result = writeQueue.then(operation)
  writeQueue = result.catch(() => undefined)
  return result
}

async function registryFile(): Promise<string> {
  return join(await libraryRoot(), 'library.json')
}

export async function readRegistry(): Promise<SpeciesLibrary> {
  const file = await registryFile()
  if (!(await exists(file))) {
    return { ...EMPTY_LIBRARY, species: {} }
  }
  try {
    const raw = JSON.parse(
      new TextDecoder().decode(await readFile(file)),
    ) as Partial<SpeciesLibrary>
    if (
      !raw ||
      typeof raw.species !== 'object' ||
      !raw.species ||
      Array.isArray(raw.species)
    ) {
      throw new Error('物种库格式不合法')
    }
    return { version: 1, species: raw.species }
  } catch {
    throw new Error('本地物种库读取失败，请保留原文件并重试。')
  }
}

async function writeRegistry(lib: SpeciesLibrary): Promise<void> {
  const root = await libraryRoot()
  await mkdir(root, { recursive: true })
  const tempFile = await join(root, `library-${crypto.randomUUID()}.tmp`)
  try {
    await writeFile(tempFile, new TextEncoder().encode(JSON.stringify(lib, null, 2)))
    await rename(tempFile, await registryFile())
  } catch (error) {
    if (await exists(tempFile)) await remove(tempFile)
    throw error
  }
}

export async function listCustomSpecies(): Promise<CustomSpeciesMeta[]> {
  const lib = await readRegistry()
  return Object.values(lib.species).sort((a, b) => a.createdAt - b.createdAt)
}

export async function getCustomSpecies(code: string): Promise<CustomSpeciesMeta | null> {
  validateCode(code)
  const lib = await readRegistry()
  return Object.hasOwn(lib.species, code) ? lib.species[code] : null
}

/** 18 帧先写入临时目录，完整后再发布目录与注册表，失败不暴露半成品。 */
export async function saveSpeciesToLibrary(
  meta: Omit<CustomSpeciesMeta, 'createdAt'>,
  frames: GrowthFrames<Uint8Array>,
  signal?: AbortSignal,
): Promise<void> {
  validateCode(meta.code)
  if (!hasCompleteGrowthFrames(frames)) throw new Error('请先补齐三阶段共 18 帧。')
  const careProfile = validateCareProfile(meta.careProfile)
  return serializeWrite(() => saveNewSpecies({ ...meta, careProfile }, frames, signal))
}

async function saveNewSpecies(
  meta: Omit<CustomSpeciesMeta, 'createdAt'>,
  frames: GrowthFrames<Uint8Array>,
  signal?: AbortSignal,
): Promise<void> {
  signal?.throwIfAborted()
  const lib = await readRegistry()
  if (Object.hasOwn(lib.species, meta.code)) throw new Error('本机已有相同物种标识。')
  const root = await libraryRoot()
  const target = await join(root, meta.code)
  if (await exists(target)) throw new Error('该物种目录已存在，请更换物种标识。')
  const pending = await join(root, `pending-${crypto.randomUUID()}`)
  lib.species[meta.code] = { ...meta, artVersion: 2, createdAt: Date.now() }
  await publishSpecies({ lib, frames, pending, target, signal })
}

async function publishSpecies(options: {
  lib: SpeciesLibrary
  frames: GrowthFrames<Uint8Array>
  pending: string
  target: string
  signal?: AbortSignal
}): Promise<void> {
  const { lib, frames, pending, target, signal } = options
  let hasPublishedDirectory = false
  try {
    await writeGrowthFrames(pending, frames, signal)
    signal?.throwIfAborted()
    // 发布开始后完成注册表写入或回滚，不在两者之间中断。
    await rename(pending, target)
    hasPublishedDirectory = true
    await writeRegistry(lib)
  } catch (error) {
    const cleanup = hasPublishedDirectory ? target : pending
    if (await exists(cleanup)) await remove(cleanup, { recursive: true })
    throw error
  }
}

async function writeGrowthFrames(
  directory: string,
  frames: GrowthFrames<Uint8Array>,
  signal?: AbortSignal,
): Promise<void> {
  for (const stage of GROWTH_STAGE_KEYS) {
    signal?.throwIfAborted()
    const stageDir = await join(directory, stage)
    await mkdir(stageDir, { recursive: true })
    for (const frame of FRAME_KEYS) {
      signal?.throwIfAborted()
      const bytes = frames[stage][frame]
      if (!bytes?.length) throw new Error('缺少状态图片。')
      await writeFile(await join(stageDir, `${frame}1.png`), bytes)
    }
  }
}

/** 读取自定义物种全部帧，转为 object URL（缓存；供 speciesArt 注册与卡片预览） */
export async function loadCustomSpeciesFrameUrls(
  code: string,
  signal?: AbortSignal,
): Promise<SpeciesFrames<string>> {
  validateCode(code)
  const meta = await getCustomSpecies(code)
  signal?.throwIfAborted()
  const frames: SpeciesFrames<string> = {}
  const stages = meta?.artVersion === 2 ? GROWTH_STAGE_KEYS : (['stage0'] as const)
  const root = await join(await libraryRoot(), code)
  for (const stage of stages) {
    frames[stage] = {}
    for (const frame of FRAME_KEYS) {
      signal?.throwIfAborted()
      const file = await join(root, stage, `${frame}1.png`)
      if (!(await exists(file))) continue
      frames[stage]![frame] = await fileToObjectUrl(file, signal)
    }
  }
  return frames
}

export async function fileToObjectUrl(
  file: string,
  signal?: AbortSignal,
): Promise<string> {
  signal?.throwIfAborted()
  const version = urlGeneration
  const cached = urlCache.get(file)
  if (cached) return cached
  const bytes = await readFile(file)
  signal?.throwIfAborted()
  if (version !== urlGeneration) throw new Error('素材读取已失效。')
  const latest = urlCache.get(file)
  if (latest) return latest
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'image/png' }))
  urlCache.set(file, url)
  return url
}

export function disposeSpeciesUrls(): void {
  urlGeneration += 1
  clearCustomSpeciesFrames()
  for (const url of urlCache.values()) URL.revokeObjectURL(url)
  urlCache.clear()
}

/** 删除自定义物种（帧 + 注册表条目） */
export async function deleteCustomSpecies(code: string): Promise<void> {
  validateCode(code)
  return serializeWrite(async () => {
    const lib = await readRegistry()
    delete lib.species[code]
    await writeRegistry(lib)
    const dir = await join(await libraryRoot(), code)
    if (await exists(dir)) await remove(dir, { recursive: true })
  })
}
