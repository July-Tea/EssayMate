import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import router from './router'
import './style.css'
import App from './App.vue'

console.log('开始初始化应用...')

const app = createApp(App)
const pinia = createPinia()

console.log('注册应用插件...')
app.use(pinia)
app.use(ElementPlus)
app.use(router)

console.log('挂载应用...')
app.mount('#app')

console.log('应用初始化完成')
