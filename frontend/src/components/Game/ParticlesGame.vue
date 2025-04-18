<template>
  <div class="particles-game">
    <div class="game-container" ref="gameContainer">
      <canvas id="particles-canvas" ref="gameCanvas" :width="canvasWidth" :height="canvasHeight"></canvas>
    </div>
  </div>
</template>

<script>
export default {
  name: 'ParticlesGame',
  props: {
    width: {
      type: Number,
      default: 440
    },
    height: {
      type: Number,
      default: 330
    }
  },
  data() {
    return {
      canvasWidth: 440,
      canvasHeight: 330,
      gameInitialized: false,
      wasmModule: null,
      resizeObserver: null,
      particleAnimation: null
    };
  },
  computed: {
    aspectRatio() {
      return this.width / this.height;
    }
  },
  async mounted() {
    try {
      // 初始化尺寸
      this.updateCanvasSize();
      
      // 使用ResizeObserver监听容器大小变化
      this.setupResizeObserver();
      
      // 动态导入WASM模块
      const wasmModule = await import('../../wasm/Particles/particles.js');
      this.wasmModule = wasmModule;
      
      // 初始化WASM
      await wasmModule.default();
      
      // 创建粒子动画实例
      this.particleAnimation = new wasmModule.ParticleAnimation('particles-canvas');
      
      // 配置粒子系统
      wasmModule.set_particle_config(50, 10, 2, 5); // 初始粒子数、点击添加数、最小尺寸、最大尺寸
      
      // 启动动画
      this.particleAnimation.start();
      this.gameInitialized = true;
      
      // 添加窗口大小调整事件
      window.addEventListener('resize', this.handleResize);
      
      // 首次调整大小
      this.handleResize();
      
      // 通知父组件游戏已加载完成
      this.$emit('game-loaded');
    } catch (error) {
      console.error('加载WASM粒子系统时出错:', error);
    }
  },
  beforeUnmount() {
    // 停止动画
    if (this.particleAnimation) {
      this.particleAnimation.stop();
      this.particleAnimation.free();
    }
    
    // 清理事件监听器
    window.removeEventListener('resize', this.handleResize);
    
    // 清理ResizeObserver
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
  },
  methods: {
    setupResizeObserver() {
      if (window.ResizeObserver) {
        this.resizeObserver = new ResizeObserver(entries => {
          this.updateCanvasSize();
        });
        
        const container = this.$refs.gameContainer;
        if (container) {
          this.resizeObserver.observe(container);
        }
      }
    },
    
    updateCanvasSize() {
      const gameContainer = this.$refs.gameContainer;
      if (!gameContainer) return;
      
      const parentElement = gameContainer.parentElement;
      if (!parentElement) return;
      
      // 使用固定尺寸
      this.canvasWidth = this.width;
      this.canvasHeight = this.height;
      
      // 更新Canvas尺寸
      const canvas = this.$refs.gameCanvas;
      if (canvas) {
        canvas.width = this.canvasWidth;
        canvas.height = this.canvasHeight;
      }
      
      if (gameContainer) {
        gameContainer.style.width = '100%';
        gameContainer.style.height = '100%';
      }
    },
    
    handleResize() {
      this.updateCanvasSize();
    }
  }
};
</script>

<style scoped>
.particles-game {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1;
}

.game-container {
  position: relative;
  width: 100%;
  height: 100%;
  background-color: #fff;
  box-sizing: border-box;
  overflow: hidden;
}

canvas {
  position: absolute;
  top: 0;
  left: 0;
  width: 100% !important;
  height: 100% !important;
  box-sizing: border-box;
}
</style> 