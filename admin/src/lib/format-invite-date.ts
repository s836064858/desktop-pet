const date = new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' })

export function formatInviteDate(iso: string): string {
  return date.format(new Date(iso))
}
