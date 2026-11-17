// 面板生图：复用全局提示词模板，用户原图只参与三阶段主形象。
import { arkGenerateImage, bytesToDataUrl } from './arkClient'
import type { FrameName } from './spriteFrames'
import { GROWTH_STAGE_LABELS } from './spriteFrames'
import type { GrowthStage } from './growth'
import spritePromptsJson from '../../scripts/sprite-prompts.json'

export { FRAME_KEYS } from './spriteFrames'
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
const prompts = spritePromptsJson as unknown as SpritePrompts

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

export function buildDerivedPrompt(
  desc: string,
  frame: FrameName,
  speciesState: string,
): string {
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

export function buildGrowthPrompt(options: {
  desc: string
  stage: GrowthStage
  stageDescription: string
  frame: FrameName
  speciesState: string
  hasPlantReference?: boolean
}): string {
  const { desc, stage, stageDescription, frame, speciesState } = options
  const base =
    frame === 'idle'
      ? options.hasPlantReference
        ? buildPlantReferencePrompt(desc)
        : buildIdlePrompt(desc)
      : buildDerivedPrompt(desc, frame, speciesState)
  return [
    base,
    `当前成长阶段为${GROWTH_STAGE_LABELS[stage]}，头顶植物形态严格限定为：${stageDescription}。`,
    '花盆、五官身份、手脚、正面视角、花盆宽度、横向中心与脚底基线保持一致；完整入镜并留安全边距，不靠整体缩放表达成长。不得新增不属于此物种的花、果实或器官。',
    '角色从脚底到最高叶尖的总高度不超过盆口宽度的2倍，总宽度不超过盆口宽度的2.1倍；大型植物使用紧凑株形，以叶形与叶冠密度体现成长。',
    frame === 'idle'
      ? `平静状态的植物姿态：${speciesState}。`
      : '参考图是当前阶段已确认的基础形象。保持该阶段的叶冠体积、器官结构和株形，只改变上述脸部表情与植物状态，不切换到其他成长阶段。',
  ].join('\n')
}

function buildPlantReferencePrompt(desc: string): string {
  return [
    '图片1是芽伴统一角色风格参考，只从图片1保留陶土橙色圆花盆、五官身份、粉腮红、小手小脚与画风，不保留图片1头顶的植物。',
    `图片2仅用于参考植物的器官形状、颜色、纹理与株形，结合物种描述绘制：${desc}。不复制图片2中的花盆、五官、人物、背景、文字、水印或摄影风格；植物按当前指定成长阶段改绘，不照搬参考照片的成熟程度。`,
    [
      prompts.style,
      prompts.carrier,
      prompts.compose,
      prompts.background,
      prompts.qualityTail,
    ].join('，'),
    '只生成一只芽伴花盆角色，平静微笑，自然站立。',
  ].join('\n')
}

export interface GenerateFrameOptions {
  apiKey: string
  prompt: string
  refPngBytes: Uint8Array
  plantRefPngBytes?: Uint8Array
  signal?: AbortSignal
}

export async function generateFramePng(opts: GenerateFrameOptions): Promise<Uint8Array> {
  const refDataUrl = await bytesToDataUrl(opts.refPngBytes, opts.signal)
  const plantRefDataUrl = opts.plantRefPngBytes
    ? await bytesToDataUrl(opts.plantRefPngBytes, opts.signal)
    : null
  opts.signal?.throwIfAborted()
  return arkGenerateImage({
    apiKey: opts.apiKey,
    prompt: opts.prompt,
    refDataUrl: plantRefDataUrl ? [refDataUrl, plantRefDataUrl] : refDataUrl,
    signal: opts.signal,
  })
}
