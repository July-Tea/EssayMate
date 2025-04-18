/// <reference types="vite/client" />

// 声明 Vue 单文件组件的类型
declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}
