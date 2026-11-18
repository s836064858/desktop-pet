import type { Pinia } from 'pinia'
import { createRouter, createWebHistory } from 'vue-router'
import type { RouteLocationNormalized } from 'vue-router'
import type { AdminSession } from './api/admin-session'
import { DEFAULT_ADMIN_USERNAME } from './api/admin-users'
import AdminLayout from './components/AdminLayout.vue'
import AdminHomeView from './views/AdminHomeView.vue'
import AdminLoginView from './views/AdminLoginView.vue'
import AiSettingsHelpView from './views/AiSettingsHelpView.vue'
import AiSettingsView from './views/AiSettingsView.vue'
import AdminUsersView from './views/AdminUsersView.vue'
import AiInvitesView from './views/AiInvitesView.vue'
import AiUsageView from './views/AiUsageView.vue'
import { useAdminSessionStore } from './stores/admin-session'

function resolveAdminRoute(target: RouteLocationNormalized, session: AdminSession | null) {
  if (!session) return target.meta.requiresAdmin ? { name: 'login' } : true
  if (
    target.name === 'login' ||
    (target.meta.requiresDefaultAdmin && session.username !== DEFAULT_ADMIN_USERNAME)
  ) {
    return { name: 'home' }
  }
  return true
}

export function createAdminRouter(pinia: Pinia) {
  const router = createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/admin/login', name: 'login', component: AdminLoginView },
      {
        path: '/admin',
        component: AdminLayout,
        meta: { requiresAdmin: true },
        children: [
          { path: '', name: 'home', component: AdminHomeView },
          { path: 'usage', name: 'usage', component: AiUsageView },
          { path: 'invites', name: 'invites', component: AiInvitesView },
          { path: 'ai-settings', name: 'ai-settings', component: AiSettingsView },
          { path: 'ai-settings/help', name: 'ai-settings-help', component: AiSettingsHelpView },
          {
            path: 'users',
            name: 'users',
            component: AdminUsersView,
            meta: { requiresDefaultAdmin: true },
          },
        ],
      },
      { path: '/:pathMatch(.*)*', redirect: { name: 'home' } },
    ],
    scrollBehavior(target, previous, savedPosition) {
      if (target.name === 'ai-settings-help' && target.hash) {
        const heading = document.getElementById(target.hash.slice(1))
        if (heading) return { el: heading, top: 16 }
      }
      if (target.name === 'ai-settings-help' || previous.name === 'ai-settings-help') {
        return savedPosition ?? { top: 0 }
      }
    },
  })

  let pending: AbortController | undefined
  router.beforeEach(async (target) => {
    pending?.abort()
    const controller = new AbortController()
    pending = controller
    const sessionStore = useAdminSessionStore(pinia)
    try {
      return resolveAdminRoute(target, await sessionStore.refresh(controller.signal))
    } catch {
      if (controller.signal.aborted) return false
      sessionStore.clear()
      return target.meta.requiresAdmin ? { name: 'login', query: { reason: 'unavailable' } } : true
    } finally {
      if (pending === controller) pending = undefined
    }
  })

  return router
}
