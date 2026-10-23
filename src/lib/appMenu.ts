import { getVersion } from '@tauri-apps/api/app'
import { Menu, Submenu } from '@tauri-apps/api/menu'
import { APP_DISPLAY_NAME, APP_NAME } from '../config/brand'

export interface AppMenuOutcome {
  ok: boolean
  detail: string
}

// Windows 没有应用级菜单栏，只有 macOS 需要覆盖英文默认菜单
function isMacos(): boolean {
  return navigator.userAgent.includes('Mac')
}

export async function initAppMenu(): Promise<AppMenuOutcome> {
  if (!isMacos()) {
    return { ok: true, detail: '非 macOS，跳过应用菜单设置' }
  }
  try {
    const version = await getVersion()
    const appSubmenu = await Submenu.new({
      id: 'app-menu-app',
      // macOS 会强制把首个子菜单标题显示为包名 Sproutkin，这里只决定菜单项文案
      text: APP_NAME,
      items: [
        { text: `关于${APP_NAME}`, item: { About: { name: APP_DISPLAY_NAME, version } } },
        { item: 'Separator' },
        { text: '服务', item: 'Services' },
        { item: 'Separator' },
        { text: `隐藏${APP_NAME}`, item: 'Hide' },
        { text: '隐藏其他', item: 'HideOthers' },
        { text: '全部显示', item: 'ShowAll' },
        { item: 'Separator' },
        { text: `退出${APP_NAME}`, item: 'Quit' },
      ],
    })
    const editSubmenu = await Submenu.new({
      id: 'app-menu-edit',
      text: '编辑',
      items: [
        { text: '撤消', item: 'Undo' },
        { text: '重做', item: 'Redo' },
        { item: 'Separator' },
        { text: '剪切', item: 'Cut' },
        { text: '拷贝', item: 'Copy' },
        { text: '粘贴', item: 'Paste' },
        { text: '全选', item: 'SelectAll' },
      ],
    })
    const viewSubmenu = await Submenu.new({
      id: 'app-menu-view',
      text: '显示',
      items: [{ text: '进入全屏幕', item: 'Fullscreen' }],
    })
    const windowSubmenu = await Submenu.new({
      id: 'app-menu-window',
      text: '窗口',
      items: [
        { text: '最小化', item: 'Minimize' },
        { text: '缩放', item: 'Maximize' },
        { item: 'Separator' },
        { text: '关闭窗口', item: 'CloseWindow' },
      ],
    })
    const menu = await Menu.new({
      id: 'app-menu',
      items: [appSubmenu, editSubmenu, viewSubmenu, windowSubmenu],
    })
    await menu.setAsAppMenu()
    return { ok: true, detail: '应用菜单已设为中文（关于/编辑/显示/窗口）' }
  } catch (err) {
    return { ok: false, detail: `应用菜单设置失败：${String(err)}` }
  }
}
