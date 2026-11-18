import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { DraftState, Frame, Stage } from './ai-draft.model'
import { CHAT_MODEL, IMAGE_MODEL } from './ark-provider'

const root = resolve(__dirname, '../../..')
const stageNames = { juvenile: '幼年体', adult: '成年体', full: '完全体' }
const stageSilhouettes: Record<Stage, string> = {
  juvenile: '苗期。株冠宽约为盆口的 0.55–0.8 倍，明显窄于盆口。少量小叶或幼小株体集中在中央，叶间留白，露出盆土和盆口两侧。已知会开花的物种也画营养生长阶段，使用幼叶与嫩芽，不画开放花朵。',
  adult: '成株初期。株冠宽约为盆口的 1.0–1.25 倍。以成形主茎、较大的成熟叶、新生侧枝或物种自然的生长点构成清晰轮廓，仍留可见空隙。花是识别特征时只点缀少量花苞，至多一朵初花，保留以枝叶为主的轮廓。',
  full: '成熟期。株冠宽约为盆口的 1.4–1.75 倍，呈该物种成熟株形，有明显的分层和饱满轮廓。开花型可用多朵具代表性的成熟花与层叠叶冠。非观花型靠成熟叶型、分枝、叶序或自然群生区分阶段。',
}

export function styleReference() {
  return readFile(resolve(root, 'src/assets/sprite-ref/style-ref.png'))
}

export async function planRequest(state: DraftState, text: string) {
  const guide = await readFile(resolve(root, 'server/assets/plant-planner.txt'), 'utf8')
  return {
    model: CHAT_MODEL, stream: false, thinking: { type: 'disabled' },
    instructions: guide + (state.plan ? `\n当前档案：${JSON.stringify(state.plan)}` : ''),
    input: [
      ...state.messages.filter((item) => item.status === 'done').slice(-12).map((item) => ({
        role: item.role, ...(item.role === 'assistant' ? { type: 'message' } : {}),
        content: [{ type: item.role === 'user' ? 'input_text' : 'output_text', text: item.text }],
      })),
      { role: 'user', content: [{ type: 'input_text', text },
        ...(state.reference ? [{ type: 'input_image', image_url: state.reference }] : [])] },
    ],
  }
}

export async function imageRequest(state: DraftState, stage: Stage, frame: Frame, reference: Buffer) {
  const plan = state.plan
  if (!plan) throw new Error('植物档案不存在')
  const source = await readFile(resolve(root, 'scripts/sprite-prompts.json'), 'utf8')
  const prompts = JSON.parse(source) as { style: string; carrier: string; compose: string; background: string; qualityTail: string; faces: Record<Frame, string> }
  const idle = frame === 'idle'
  const image = `data:image/png;base64,${reference.toString('base64')}`
  const prompt = [
    idle
      ? `目标阶段：${stageNames[stage]}。只画一个角色，以此阶段特征为准：${stageSilhouettes[stage]}\n物种特征：${plan.desc}。档案：${plan.stages[stage]}。只画该物种真实的器官。`
      : `沿用已确认主形象的株形、枝叶数量与花量。植物状态：${plan.states[frame]}。`,
    idle && state.reference ? '图2仅参考器官形态、色纹，株龄和花量按指定阶段重画。' : '',
    `花盆脸表情：${idle ? '平静微笑' : prompts.faces[frame]}。`,
    idle ? `植株姿态参考：${plan.states.idle}。器官数量与成熟度遵守目标阶段。` : '',
    '保留图1的花盆造型、尺寸、脚底基线和画风。整株最高为盆口宽度2倍，最宽2.1倍。',
    prompts.style, prompts.carrier, prompts.compose, prompts.background,
  ].filter(Boolean).join('\n')
  return { model: IMAGE_MODEL, prompt, image: idle && state.reference ? [image, state.reference] : image,
    response_format: 'b64_json', size: '1024x1024', stream: false, watermark: false, output_format: 'png' }
}
