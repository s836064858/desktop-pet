import { defineStore } from 'pinia'
import { shallowRef } from 'vue'
import { getAdminSession, loginAdmin, logoutAdmin } from '../api/admin-session'
import type { AdminLogin, AdminSession } from '../api/admin-session'

export const useAdminSessionStore = defineStore('admin-session', () => {
  const session = shallowRef<AdminSession | null>(null)
  let revision = 0

  async function refresh(signal: AbortSignal): Promise<AdminSession | null> {
    const current = ++revision
    const next = await getAdminSession(signal)
    signal.throwIfAborted()
    if (current === revision) session.value = next
    return session.value
  }

  async function login(credentials: AdminLogin, signal: AbortSignal): Promise<void> {
    const current = ++revision
    const next = await loginAdmin(credentials, signal)
    signal.throwIfAborted()
    if (current === revision) session.value = next
  }

  async function logout(signal: AbortSignal): Promise<void> {
    await logoutAdmin(signal)
    signal.throwIfAborted()
    clear()
  }

  function clear(): void {
    revision += 1
    session.value = null
  }

  return { session, refresh, login, logout, clear }
})
