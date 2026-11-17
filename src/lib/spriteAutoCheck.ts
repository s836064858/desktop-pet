import { encodePng, prepareSpritePng } from './spritePipeline'
import type { RawImage } from './spritePipeline'
import {
  ALIGNMENT,
  inspectSpriteAlignment,
  normalizeSpriteAlignment,
} from './spriteAlignment'
import { compareSpriteGeometry, detectSpriteGeometry } from './spriteDetection'
import type { SpriteGeometry } from './spriteDetection'

export async function autoCheckSprite(options: {
  png: Uint8Array
  reference?: SpriteGeometry
  signal: AbortSignal
}): Promise<{ bytes: Uint8Array; geometry: SpriteGeometry }> {
  options.signal.throwIfAborted()
  const image = await prepareSpritePng(options.png)
  options.signal.throwIfAborted()
  const geometry = detectSpriteGeometry(image)
  compareSpriteGeometry({ actual: geometry, reference: options.reference })
  removeFloorShadow({ image, footY: geometry.anchor.footY })
  const issues = inspectSpriteAlignment({ image, anchor: geometry.anchor })
  if (issues.length) throw new Error(issues.join('\n'))
  const rgba = normalizeSpriteAlignment({ image, anchor: geometry.anchor })
  validateNormalizedGeometry({ rgba, width: ALIGNMENT.size, height: ALIGNMENT.size })
  const bytes = await encodePng(rgba, ALIGNMENT.size, ALIGNMENT.size)
  options.signal.throwIfAborted()
  return { bytes, geometry }
}

function validateNormalizedGeometry(image: RawImage): void {
  const { anchor } = detectSpriteGeometry(image)
  if (
    Math.abs(anchor.centerX - ALIGNMENT.centerX) > 3 ||
    Math.abs(anchor.footY - ALIGNMENT.footY) > 2 ||
    Math.abs(anchor.potWidth - ALIGNMENT.potWidth) > 8
  )
    throw new Error('归一化后的花盆位置或脚底未通过复检，请重新生成这一帧。')
}

// 灰白地面阴影不是角色脚底；只清除已识别脚底以下的浅中性像素，不动植物、脚或彩色特效。
function removeFloorShadow({ image, footY }: { image: RawImage; footY: number }): void {
  for (let y = Math.floor(footY) + 1; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      const offset = (y * image.width + x) * 4
      const r = image.rgba[offset]
      const g = image.rgba[offset + 1]
      const b = image.rgba[offset + 2]
      if (Math.max(r, g, b) - Math.min(r, g, b) < 18 && Math.min(r, g, b) > 150)
        image.rgba[offset + 3] = 0
    }
  }
}
