// 本地素材库（appData）：自定义物种的帧 PNG 与元数据注册表
// 布局：appDataDir()/sprite-library/{code}/stage0/{帧}1.png + sprite-library/library.json
import { appDataDir, join } from '@tauri-apps/api/path'
import { exists, mkdir, readFile, remove, writeFile } from '@tauri-apps/plugin-fs'
import type { FrameName } from './speciesArt'
import { validateCareProfile } from './careProfile'
import type { CareProfile } from './careProfile'

export interface CustomSpeciesMeta {
  code: string
  name: string
  emoji: string
  desc: string
  states: Record<string, string>
  createdAt: number
  careProfile?: CareProfile
}

export interface SpeciesLibrary {
  version: 1
  species: Record<string, CustomSpeciesMeta>
}

const EMPTY_LIBRARY: SpeciesLibrary = { version: 1, species: {} }
const urlCache = new Map<string, string>()
let urlGeneration = 0

async function libraryRoot(): Promise<string> {
  return join(await appDataDir(), 'sprite-library')
}

async function stage0Dir(code: string): Promise<string> {
  return join(await libraryRoot(), code, 'stage0')
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
    if (!raw || typeof raw.species !== 'object' || !raw.species || Array.isArray(raw.species)) {
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
  await writeFile(await registryFile(), new TextEncoder().encode(JSON.stringify(lib, null, 2)))
}

export async function listCustomSpecies(): Promise<CustomSpeciesMeta[]> {
  const lib = await readRegistry()
  return Object.values(lib.species).sort((a, b) => a.createdAt - b.createdAt)
}

export async function getCustomSpecies(code: string): Promise<CustomSpeciesMeta | null> {
  const lib = await readRegistry()
  return Object.hasOwn(lib.species, code) ? lib.species[code] : null
}

/** 入库：写入 6 帧 stage0 PNG + 元数据注册表 */
export async function saveSpeciesToLibrary(
  meta: Omit<CustomSpeciesMeta, 'createdAt'>,
  frames: Partial<Record<FrameName, Uint8Array>>,
): Promise<void> {
  if (!/^[a-z][a-z0-9-]*$/.test(meta.code)) throw new Error('物种标识不合法。')
  const careProfile = validateCareProfile(meta.careProfile)
  const stage0 = await stage0Dir(meta.code)
  await mkdir(stage0, { recursive: true })
  for (const [frame, bytes] of Object.entries(frames)) {
    if (!bytes) continue
    const file = await join(stage0, `${frame}1.png`)
    await writeFile(file, bytes)
    const previous = urlCache.get(file)
    if (previous) URL.revokeObjectURL(previous)
    urlCache.delete(file)
  }
  const lib = await readRegistry()
  lib.species[meta.code] = { ...meta, careProfile, createdAt: Date.now() }
  await writeRegistry(lib)
}

/** 读取自定义物种全部帧，转为 object URL（缓存；供 speciesArt 注册与卡片预览） */
export async function loadCustomSpeciesFrameUrls(
  code: string,
  signal?: AbortSignal,
): Promise<Partial<Record<FrameName, string>>> {
  const stage0 = await stage0Dir(code)
  const frames: Partial<Record<FrameName, string>> = {}
  for (const frame of ['idle', 'happy', 'thirsty', 'water', 'sun', 'sleep'] as FrameName[]) {
    signal?.throwIfAborted()
    const file = await join(stage0, `${frame}1.png`)
    if (!(await exists(file))) continue
    frames[frame] = await fileToObjectUrl(file, signal)
  }
  return frames
}

export async function fileToObjectUrl(file: string, signal?: AbortSignal): Promise<string> {
  signal?.throwIfAborted()
  const version = urlGeneration
  const cached = urlCache.get(file)
  if (cached) return cached
  const bytes = await readFile(file)
  signal?.throwIfAborted()
  if (version !== urlGeneration) throw new Error('素材读取已失效。')
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'image/png' }))
  urlCache.set(file, url)
  return url
}

export function disposeSpeciesUrls(): void {
  urlGeneration += 1
  for (const url of urlCache.values()) URL.revokeObjectURL(url)
  urlCache.clear()
}

/** 删除自定义物种（帧 + 注册表条目） */
export async function deleteCustomSpecies(code: string): Promise<void> {
  const lib = await readRegistry()
  delete lib.species[code]
  await writeRegistry(lib)
  const dir = await join(await libraryRoot(), code)
  if (await exists(dir)) {
    await remove(dir, { recursive: true })
  }
}
