// 本地素材库（appData）：自定义物种的帧 PNG 与元数据注册表
// 布局：appDataDir()/sprite-library/{code}/stage0/{帧}1.png + sprite-library/library.json
import { appDataDir, join } from '@tauri-apps/api/path'
import { exists, mkdir, readFile, remove, writeFile } from '@tauri-apps/plugin-fs'
import type { FrameName } from './speciesArt'

export interface CustomSpeciesMeta {
  code: string
  name: string
  emoji: string
  desc: string
  states: Record<string, string>
  waterIntervalH: number
  sunIntervalH: number
  createdAt: number
}

export interface SpeciesLibrary {
  version: 1
  species: Record<string, CustomSpeciesMeta>
}

const EMPTY_LIBRARY: SpeciesLibrary = { version: 1, species: {} }
const urlCache = new Map<string, string>()

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
    const raw = JSON.parse(new TextDecoder().decode(await readFile(file))) as Partial<SpeciesLibrary>
    return { version: 1, species: raw.species ?? {} }
  } catch {
    return { ...EMPTY_LIBRARY, species: {} }
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
  return lib.species[code] ?? null
}

/** 入库：写入 6 帧 stage0 PNG + 元数据注册表 */
export async function saveSpeciesToLibrary(
  meta: Omit<CustomSpeciesMeta, 'createdAt'>,
  frames: Partial<Record<FrameName, Uint8Array>>,
): Promise<void> {
  const stage0 = await stage0Dir(meta.code)
  await mkdir(stage0, { recursive: true })
  for (const [frame, bytes] of Object.entries(frames)) {
    if (!bytes) continue
    const file = await join(stage0, `${frame}1.png`)
    await writeFile(file, bytes)
    urlCache.delete(file) // 新图覆盖后刷新缓存
  }
  const lib = await readRegistry()
  lib.species[meta.code] = { ...meta, createdAt: Date.now() }
  await writeRegistry(lib)
}

/** 读取自定义物种全部帧，转为 object URL（缓存；供 speciesArt 注册与卡片预览） */
export async function loadCustomSpeciesFrameUrls(code: string): Promise<Partial<Record<FrameName, string>>> {
  const stage0 = await stage0Dir(code)
  const frames: Partial<Record<FrameName, string>> = {}
  for (const frame of ['idle', 'happy', 'thirsty', 'water', 'sun', 'sleep'] as FrameName[]) {
    const file = await join(stage0, `${frame}1.png`)
    if (!(await exists(file))) continue
    frames[frame] = await fileToObjectUrl(file)
  }
  return frames
}

export async function fileToObjectUrl(file: string): Promise<string> {
  const cached = urlCache.get(file)
  if (cached) return cached
  const bytes = await readFile(file)
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'image/png' }))
  urlCache.set(file, url)
  return url
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
