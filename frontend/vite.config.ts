import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import wasm from 'vite-plugin-wasm'
import topLevelAwait from 'vite-plugin-top-level-await'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    wasm(),
    topLevelAwait()
  ],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        manualChunks: {
          'element-plus': ['element-plus'],
          'vue-router': ['vue-router'],
          'pinia': ['pinia']
        }
      }
    }
  },
  optimizeDeps: {
    exclude: ['wasm-pinball-game']
  }
})
