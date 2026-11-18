import { CHAT_MODEL, IMAGE_MODEL } from './ark-provider'

const chatPrice = { type: 'chat', model: CHAT_MODEL, inputPerMillion: 0.8, outputPerMillion: 2.7, cachedInputPerMillion: 0.16 } as const
const imagePrice = { type: 'image', model: IMAGE_MODEL, perImage: 0.12 } as const

export const modelPricing = [imagePrice, chatPrice] as const

export const generatedImagesSql = `CASE WHEN type = 'image' THEN COALESCE(generated_images,
  CASE WHEN result = 'success' THEN 1 END) END`

export const usageCostSql = `CASE
  WHEN model = ? AND type = 'image' THEN (${generatedImagesSql}) * CAST(? AS DECIMAL(12,8))
  WHEN model = ? AND type = 'chat' AND cached_input_tokens <= input_tokens THEN
    (CAST(input_tokens AS SIGNED) - CAST(cached_input_tokens AS SIGNED)) * CAST(? AS DECIMAL(12,8))
    + output_tokens * CAST(? AS DECIMAL(12,8))
    + cached_input_tokens * CAST(? AS DECIMAL(12,8))
  END`

export const usageCostParams = [
  imagePrice.model, imagePrice.perImage.toFixed(8), chatPrice.model,
  (chatPrice.inputPerMillion / 1_000_000).toFixed(8),
  (chatPrice.outputPerMillion / 1_000_000).toFixed(8),
  (chatPrice.cachedInputPerMillion / 1_000_000).toFixed(8),
]
