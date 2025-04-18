import { createRouter, createWebHistory } from 'vue-router'
import { useConfigStore } from '../stores/config'
import InitConfig from '../views/InitConfig.vue'
import Home from '../views/Home.vue'
import DatabaseView from '../views/DatabaseView.vue'
import LogsView from '../views/LogsView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'init',
      component: InitConfig,
      meta: { requiresConfig: false }
    },
    {
      path: '/home',
      name: 'home',
      component: Home,
      meta: { requiresConfig: true }
    },
    {
      path: '/database',
      name: 'database',
      component: DatabaseView,
      meta: { requiresConfig: false }
    },
    {
      path: '/logs',
      name: 'logs',
      component: LogsView,
      meta: { requiresConfig: false }
    }
  ]
})

// 路由守卫，检查是否已完成初始化配置
router.beforeEach(async (to, from, next) => {
  console.log('路由守卫触发:', { to: to.path, from: from.path })
  const configStore = useConfigStore()
  
  // 确保配置已加载
  if (configStore.status === 'initial') {
    try {
      await configStore.loadConfig()
    } catch (error) {
      console.error('加载配置失败:', error)
    }
  }
  
  const isConfigured = configStore.isConfigured
  console.log('当前配置状态:', { isConfigured, config: configStore.config, status: configStore.status })
  
  if (to.meta.requiresConfig && !isConfigured) {
    console.log('需要配置但未配置，重定向到初始化页面')
    next({ name: 'init' })
  } else if (!to.meta.requiresConfig && isConfigured && to.name === 'init') {
    console.log('已配置且尝试访问初始化页面，重定向到首页')
    next({ name: 'home' })
  } else {
    console.log('正常导航到:', to.path)
    next()
  }
})

export default router