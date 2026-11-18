<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import plantPreview from '../../../src/assets/pets/pothos/juvenile/idle1.png'
import { AdminSessionError } from '../api/admin-session'
import type { AdminLogin } from '../api/admin-session'
import AdminLoginForm from '../components/AdminLoginForm.vue'
import BrandMark from '../components/BrandMark.vue'
import { useAdminAction } from '../composables/use-admin-action'
import { useAdminSessionStore } from '../stores/admin-session'

const route = useRoute()
const router = useRouter()
const sessionStore = useAdminSessionStore()
const { isPending, errorMessage, run } = useAdminAction()
const notice = computed(() => {
  if (route.query.reason === 'expired') return '登录已过期，请重新登录。'
  if (route.query.reason === 'unavailable') return '暂时无法检查登录状态，请在服务恢复后重试。'
  return ''
})

function describeLoginError(error: unknown): string {
  if (error instanceof AdminSessionError) {
    if (error.status === 400) return '请输入有效的管理员账号和密码。'
    if (error.status === 401) return '账号或密码错误。'
    if (error.status === 429) return '登录尝试过于频繁，请稍后重试。'
  }
  return '暂时无法登录，请检查服务连接后重试。'
}

async function login(credentials: AdminLogin): Promise<void> {
  const hasLoggedIn = await run(
    (signal) => sessionStore.login(credentials, signal),
    describeLoginError,
  )
  if (hasLoggedIn) await router.replace({ name: 'home' })
}
</script>

<template>
  <main class="login-layout">
    <section class="login-layout__visual" aria-hidden="true">
      <div class="login-layout__visual-title">芽伴 <span>SPROUTKIN</span></div>
      <div class="login-layout__portrait">
        <img :src="plantPreview" alt="" width="400" height="400" />
      </div>
    </section>
    <section class="login-layout__content" aria-labelledby="login-heading">
      <BrandMark />
      <div class="login-layout__heading">
        <h1 id="login-heading">管理后台登录</h1>
        <p v-if="notice && !errorMessage" class="login-layout__notice" role="status">
          {{ notice }}
        </p>
      </div>
      <AdminLoginForm :is-pending="isPending" :error-message="errorMessage" @submit="login" />
    </section>
  </main>
</template>

<style scoped>
.login-layout {
  display: grid;
  min-height: 100dvh;
  grid-template-columns: minmax(19rem, 0.95fr) minmax(26rem, 1fr);
  padding: clamp(0.75rem, 2.2vw, 1.75rem);
}

.login-layout__visual {
  position: relative;
  display: grid;
  place-items: center;
  border-radius: 8px;
  background: #18332b;
  overflow: hidden;
}

.login-layout__visual-title {
  position: absolute;
  top: 1.25rem;
  left: 1.5rem;
  color: #fff;
  font-size: 1rem;
  font-weight: 650;
}

.login-layout__visual-title span {
  margin-left: 0.4rem;
  color: #b7cfc1;
  font-size: 0.75rem;
}

.login-layout__portrait {
  display: grid;
  place-items: center;
  width: min(76%, 25rem);
  aspect-ratio: 1;
  border: 1px solid #678476;
  border-radius: 50% 50% 8px 8px;
  background: #d9e9da;
}

.login-layout__portrait img {
  width: 91%;
  height: auto;
  object-fit: contain;
}

.login-layout__content {
  align-self: center;
  justify-self: center;
  width: min(100%, 22.5rem);
  margin: 2.5rem;
}

.login-layout__heading {
  margin: 2.55rem 0 1.8rem;
}

.login-layout__heading h1 {
  margin: 0;
  font-size: 1.85rem;
  font-weight: 650;
}

.login-layout__notice {
  margin: 0.7rem 0 0;
  color: var(--color-muted);
  font-size: 0.9rem;
}

@media (max-width: 760px) {
  .login-layout {
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr;
  }

  .login-layout__visual {
    min-height: 8.75rem;
  }

  .login-layout__visual-title { display: none; }

  .login-layout__portrait {
    width: 7.2rem;
    border-radius: 50% 50% 0.55rem 0.55rem;
  }

  .login-layout__content {
    align-self: start;
    width: min(calc(100% - 2rem), 22.5rem);
    margin: 2rem 0;
  }

  .login-layout__heading {
    margin: 1.6rem 0 1.4rem;
  }
}
</style>
