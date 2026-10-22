import { defaultWindowIcon } from '@tauri-apps/api/app'
import { exit } from '@tauri-apps/plugin-process'
import { Menu } from '@tauri-apps/api/menu'
import { TrayIcon } from '@tauri-apps/api/tray'
import { showPanelWindow } from './lib/capabilities'
import { APP_DISPLAY_NAME } from './config/brand'

export interface TrayOutcome {
  ok: boolean
  detail: string
}

export async function initTray(): Promise<TrayOutcome> {
  try {
    const menu = await Menu.new({
      items: [
        {
          id: 'show-panel',
          text: '显示面板',
          action: () => {
            void showPanelWindow()
          },
        },
        {
          id: 'quit',
          text: '退出',
          action: () => {
            void exit(0)
          },
        },
      ],
    })
    const icon = await defaultWindowIcon()
    await TrayIcon.new({
      icon: icon ?? undefined,
      tooltip: APP_DISPLAY_NAME,
      menu,
      showMenuOnLeftClick: false,
      action: (event) => {
        if (event.type === 'Click' && event.button === 'Left' && event.buttonState === 'Up') {
          void showPanelWindow()
        }
      },
    })
    return { ok: true, detail: '托盘已创建：菜单栏图标，左键唤起面板' }
  } catch (err) {
    return { ok: false, detail: `创建失败：${String(err)}` }
  }
}
