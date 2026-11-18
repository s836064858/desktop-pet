import { createPinia } from 'pinia'
import { createApp } from 'vue'
import 'element-plus/es/components/base/style/css'
import 'element-plus/es/components/button/style/css'
import 'element-plus/es/components/dialog/style/css'
import 'element-plus/es/components/input/style/css'
import 'element-plus/es/components/input-number/style/css'
import 'element-plus/es/components/option/style/css'
import 'element-plus/es/components/popconfirm/style/css'
import 'element-plus/es/components/select/style/css'
import 'element-plus/es/components/table/style/css'
import 'element-plus/es/components/tag/style/css'
import App from './App.vue'
import { createAdminRouter } from './router'
import './style.css'

const app = createApp(App)
const pinia = createPinia()
const router = createAdminRouter(pinia)

app.use(pinia)
app.use(router)
app.mount('#app')
