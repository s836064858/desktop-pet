import { createPinia } from 'pinia'
import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { attachConsole, error as logError, info } from '@tauri-apps/plugin-log'
import App from './App.vue'
import { initTray } from './tray'

async function guardPanelClose(): Promise<void> {
  const panelWindow = getCurrentWindow()
  await panelWindow.onCloseRequested(async (event) => {
    event.preventDefault()
    await panelWindow.hide()
    await info('[panel] 关闭请求已转为隐藏，托盘可再次打开')
  })
}

async function bootstrap() {
  await attachConsole()
  const app = createApp(App)
  app.use(createPinia())
  app.use(ElementPlus)
  app.mount('#app')

  await guardPanelClose()
  const tray = await initTray()
  await info(`[phase0] 托盘：${tray.detail}`)
}

bootstrap().catch((err) => {
  logError(`[phase0] 启动失败：${String(err)}`)
})
