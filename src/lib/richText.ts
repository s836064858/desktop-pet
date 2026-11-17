const ALLOWED_TAGS = new Set(['P', 'BR', 'STRONG', 'B', 'EM', 'I', 'UL', 'OL', 'LI', 'BLOCKQUOTE'])
const BLOCKED_TAGS = new Set([
  'SCRIPT',
  'STYLE',
  'IFRAME',
  'OBJECT',
  'EMBED',
  'SVG',
  'MATH',
  'TEMPLATE',
])

// 只重建文字与有限排版标签；不保留事件、样式、链接和其他属性。
export function sanitizeHabitDescription(source: string): string {
  if (typeof source !== 'string' || !source.trim()) return ''
  const template = document.createElement('template')
  template.innerHTML = source.slice(0, 4000)
  const result = document.createElement('div')
  for (const node of Array.from(template.content.childNodes)) appendSafeNode(node, result)
  return result.innerHTML
}

function appendSafeNode(node: Node, parent: HTMLElement): void {
  if (node.nodeType === Node.TEXT_NODE) {
    parent.appendChild(document.createTextNode(node.textContent ?? ''))
    return
  }
  if (!(node instanceof HTMLElement) || BLOCKED_TAGS.has(node.tagName)) return
  const target = ALLOWED_TAGS.has(node.tagName)
    ? document.createElement(node.tagName.toLowerCase())
    : parent
  if (target !== parent) parent.appendChild(target)
  for (const child of Array.from(node.childNodes)) appendSafeNode(child, target)
}
