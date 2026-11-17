// 面板版 sprite-studio：物种文案起草（方舟 Responses API）+ 六段式提示词拼装
// 提示词模板与物种 few-shot 直接复用 scripts/ 下的 JSON（与脚本侧单一数据源）
import { arkChat, arkGenerateImage, bytesToDataUrl } from './arkClient'
import type { FrameName } from './speciesArt'
import { validateCareProfile } from './careProfile'
import type { CareProfile } from './careProfile'
import spritePromptsJson from '../../scripts/sprite-prompts.json'
import spriteSpeciesJson from '../../scripts/sprite-species.json'

export const FRAME_KEYS: FrameName[] = ['idle', 'happy', 'thirsty', 'water', 'sun', 'sleep']
const FRAME_LABELS: Record<FrameName, string> = {
  idle: '平静基础态',
  happy: '开心',
  thirsty: '缺水蔫了',
  water: '被浇水很幸福',
  sun: '晒太阳',
  sleep: '熟睡',
}

interface SpritePrompts {
  style: string
  carrier: string
  compose: string
  background: string
  qualityTail: string
  faces: Record<string, string>
  states: Record<string, string>
}

interface BuiltinSpeciesEntry {
  dir: string
  name?: string
  emoji?: string
  desc: string
  states?: Record<string, string>
}

const prompts = spritePromptsJson as unknown as SpritePrompts
const builtinSpecies = (spriteSpeciesJson as { species: Record<string, BuiltinSpeciesEntry> })
  .species

export interface SpeciesDraft {
  code: string
  dir: string
  name: string
  emoji: string
  desc: string
  states: Record<FrameName, string>
  careProfile: CareProfile
}

function stripFences(text: string): string {
  const s = text.indexOf('{')
  const e = text.lastIndexOf('}')
  if (s >= 0 && e > s) return text.slice(s, e + 1)
  return text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '')
}

function validateDraft(j: unknown): SpeciesDraft {
  const bad = (m: string): never => {
    throw new Error(m)
  }
  if (!j || typeof j !== 'object' || Array.isArray(j)) bad('不是 JSON 对象')
  const obj = j as Record<string, unknown>
  if (obj.needsClarification === true) {
    throw new Error(
      `请补充植物品种：${String(obj.clarificationQuestion || '名称过于宽泛，请提供具体品种或学名。').slice(0, 200)}`,
    )
  }
  if (typeof obj.code !== 'string' || !/^[a-z][a-z0-9-]{0,63}$/.test(obj.code))
    bad('物种标识需为 64 字以内的英文小写、数字与中划线。')
  for (const [k, max] of Object.entries({ dir: 80, name: 12, desc: 120, emoji: 16 })) {
    const v = obj[k]
    if (typeof v !== 'string' || !v.trim() || v.length > max) bad(`${k} 需为 1–${max} 字`)
  }
  const st = (obj.states ?? {}) as Record<string, unknown>
  const states = {} as Record<FrameName, string>
  for (const f of FRAME_KEYS) {
    const v = st[f]
    if (typeof v !== 'string' || !v.trim() || v.length > 100) bad(`states.${f} 需为 1–100 字`)
    states[f] = v as string
  }
  return {
    code: String(obj.code),
    dir: String(obj.dir),
    name: String(obj.name),
    emoji: String(obj.emoji),
    desc: String(obj.desc),
    states,
    careProfile: validateCareProfile(obj.careProfile),
  }
}

// AI 起草物种文案：六段式规则 + 已入库物种 few-shot；解析失败带报错重试
export async function draftSpecies(
  apiKey: string,
  phrase: string,
  signal?: AbortSignal,
): Promise<SpeciesDraft> {
  const examples = Object.entries(builtinSpecies)
    .map(
      ([code, s]) =>
        `  {"code":"${code}","name":"${s.name}","desc":"${s.desc}"${s.states ? `,"states覆盖":${JSON.stringify(s.states)}` : ''}}`,
    )
    .join('\n')
  const system = `你是「芽伴 · Sproutkin」项目的素材文案助手。角色由 AI 生图产出，使用固定六段式提示词：[风格段]Q版卡通+游戏精灵立绘+粗黑描边+平涂糖果色+赛璐璐阴影；[载体段]陶土色圆形花盆作为身体+大圆眼睛+微笑嘴+粉腮红+小手小脚；[物种段]头顶植物特征；[构图段]正面全身构图，画面居中；[背景段]纯白色背景，单一角色，无文字，无水印；[质量段]高清细节。

风格段与载体段已锁定。为【一个明确的新物种】同时生成物种外形描述（desc）、6 条状态句（states）和养护习性（careProfile），供用户预览确认后保存。要求：
1. desc 一句话、具象可直接画，写清植物器官的形状/颜色/质感/姿态。
2. states 六条短句，语义固定：idle=平静基础态；happy=开心；thirsty=缺水蔫了；water=按需浇水后；sun=适宜光照下舒展（根据习性，不要求暴晒或开花）；sleep=睡着。描述必须落在该物种自己的器官上（多肉缺水是叶瓣发皱，薰衣草缺水是花穗下垂），且只描述植物本身的变化，不要写花盆表情（表情由模板统一注入）。
3. 有刺/尖/毛的物种，desc 必须加"防画凶"限定（参考仙人球："浅色小软刺（刺极短极软）"）。
4. code 用英文小写+中划线、不超过 64 字符；dir 为中文目录名、不超过 80 字；name 不超过 12 字，desc 不超过 120 字，每条 states 不超过 100 字；emoji 选一个贴合的，不超过 16 字符。
5. careProfile 只包含 waterEveryDays、lightEveryDays（均为 1–30 的整数，表示每几天安排一次浇水/光照照护）和 description（一段用于用户阅读的富文本习性描述，1–4000 字）。根据物种给出不同的默认节奏，描述说明植物偏好和季节注意事项。富文本只使用 p、strong、em、ul、ol、li、br 等排版标签，不含属性、链接、图片或脚本；不把土壤观察、健康判断、传感器阈值或成长公式作为额外字段。
6. 如果用户只说多肉等宽泛类别、名称不明确或无法确定可靠习性，不猜测。只返回 {"needsClarification":true,"clarificationQuestion":"需要用户补充的具体问题"}。

已入库物种示例（学习写法风格）：
${examples}

只输出一个 JSON 对象，不要 markdown 代码块、不要解释：
{"code":"…","dir":"…","name":"中文名","emoji":"…","desc":"…","states":{"idle":"…","happy":"…","thirsty":"…","water":"…","sun":"…","sleep":"…"},"careProfile":{"waterEveryDays":3,"lightEveryDays":2,"description":"<p><strong>植物习性</strong>：…</p>"}}`

  const messages: Array<{ role: 'system' | 'user'; content: string }> = [
    { role: 'system', content: system },
    { role: 'user', content: phrase },
  ]
  let lastErr: unknown = null
  let jsonMode = true
  for (let i = 0; i < 3; i++) {
    let content: string
    try {
      content = await arkChat({ apiKey, messages, jsonMode, label: 'AI 起草文案与习性', signal })
    } catch (err) {
      if (String(err).includes('400') && jsonMode) {
        jsonMode = false
        continue
      }
      throw err
    }
    try {
      return validateDraft(JSON.parse(stripFences(content)))
    } catch (err) {
      if (signal?.aborted || String(err).includes('请补充植物品种：')) throw err
      lastErr = err
      messages.push({
        role: 'user',
        content: `你上一次的输出不合规（${String(err)}）。请重新只输出一个合规的 JSON 对象，不要任何解释或代码块。`,
      })
    }
  }
  throw new Error(`AI 文案多次都不合规：${String(lastErr)}`)
}

// 六段式拼装：idle 要求"换头"防参考图植物残留；衍生帧必须显式列出「脸表情 + 植物状态」两处变化
// （seedream 对参考图服从性很强，只写植物状态会导致花盆脸完全不变、帧间无差异）
export function buildIdlePrompt(desc: string): string {
  const segs = [
    prompts.style,
    prompts.carrier,
    `头顶${desc}`,
    prompts.compose,
    prompts.background,
    prompts.qualityTail,
  ].join('，')
  return `保持与参考图完全相同的陶土花盆角色造型与画风，仅把头顶植物替换为：${desc}，不要出现参考图中的植物。${segs}。状态：平静微笑，自然站立`
}

export function buildDerivedPrompt(desc: string, frame: FrameName, speciesState: string): string {
  const face = prompts.faces?.[frame] ?? ''
  const changes = [
    face ? `1. 花盆脸的表情：${face}` : null,
    speciesState ? `2. 头顶植物的状态：${speciesState}` : null,
  ].filter(Boolean)
  const segs = [
    prompts.style,
    prompts.carrier,
    `头顶${desc}`,
    prompts.compose,
    prompts.background,
    prompts.qualityTail,
  ].join('，')
  return [
    `参考图是这只陶土花盆角色的平静状态。请生成它【${FRAME_LABELS[frame]}】的状态，与参考图相比必须有明显可见的变化：`,
    ...changes,
    `除以上变化外，其余与参考图保持完全一致：同一只陶土花盆角色，造型、大小、居中构图、纯白色背景不变，头顶${desc}的物种特征不变。`,
    segs,
  ].join('\n')
}

export interface GenerateFrameOptions {
  apiKey: string
  prompt: string
  refPngBytes: Uint8Array
  signal?: AbortSignal
}

export async function generateFramePng(opts: GenerateFrameOptions): Promise<Uint8Array> {
  const refDataUrl = await bytesToDataUrl(opts.refPngBytes)
  return arkGenerateImage({
    apiKey: opts.apiKey,
    prompt: opts.prompt,
    refDataUrl,
    signal: opts.signal,
  })
}
