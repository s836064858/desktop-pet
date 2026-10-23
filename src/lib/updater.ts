// 自动更新（tauri-plugin-updater，方案见 docs/自动更新方案.md D16~D18）
// 铁律：自动路径失败一律静默降级——dev 环境与「草稿未 Publish」时 endpoint 必 404，不允许打扰用户
import type { Update } from '@tauri-apps/plugin-updater'
import { check } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'
import { getVersion } from '@tauri-apps/api/app'

export type { Update }

export async function getCurrentVersion(): Promise<string> {
  return getVersion()
}

/** 静默检查；网络不通、暂无发布（草稿未 Publish，endpoint 404）等一律返回 null */
export async function probeUpdate(): Promise<Update | null> {
  try {
    return await check()
  } catch (err) {
    console.warn('[updater] 检查更新失败（已忽略）', err)
    return null
  }
}

/** 下载安装并重启应用；仅在 probeUpdate() 返回非空后调用 */
export async function installUpdate(update: Update): Promise<void> {
  await update.downloadAndInstall()
  await relaunch()
}

/** App.vue 定时调用的全自动路径：发现新版本即更新并重启，全程不打扰 */
export async function silentAutoUpdate(): Promise<void> {
  const update = await probeUpdate()
  if (!update) return
  console.info(`[updater] 发现新版本 v${update.version}，开始后台更新，完成后自动重启`)
  await installUpdate(update)
}
