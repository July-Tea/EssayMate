<script setup lang="ts">
import { Connection } from '@element-plus/icons-vue'

defineProps<{
  modelType: string
}>()

const emit = defineEmits(['update:modelType'])

const handleModelSelect = (model: string) => {
  emit('update:modelType', model)
}
</script>

<template>
  <div class="model-selector">
    <h2>选择AI模型</h2>
    <div class="model-cards">
      <el-card
        class="model-card"
        :class="{ active: modelType === 'Doubao' }"
        @click="handleModelSelect('Doubao')"
        style="--index: 0"
      >
        <div class="model-card-content">
          <div class="model-icon-wrapper">
            <img src="../../assets/model-icons/doubao-color.svg" alt="豆包AI" class="model-icon" />
          </div>
          <div class="model-info">
            <h3>豆包AI</h3>
            <p class="model-description">智能写作助手，为您提供专业的写作建议</p>
          </div>
        </div>
      </el-card>
      <el-card
        class="model-card"
        :class="{ active: modelType === 'Tongyi' }"
        @click="handleModelSelect('Tongyi')"
        style="--index: 1"
      >
        <div class="model-card-content">
          <div class="model-icon-wrapper">
            <img src="../../assets/model-icons/qwen.svg" alt="通义千问" class="model-icon" />
          </div>
          <div class="model-info">
            <h3>通义千问</h3>
            <p class="model-description">阿里云开发的大语言模型，擅长中英文写作</p>
          </div>
        </div>
      </el-card>
      <el-card
        class="model-card"
        :class="{ active: modelType === 'Kimi' }"
        @click="handleModelSelect('Kimi')"
        style="--index: 2"
      >
        <div class="model-card-content">
          <div class="model-icon-wrapper">
            <img src="../../assets/model-icons/kimi.svg" alt="Kimi" class="model-icon" />
          </div>
          <div class="model-info">
            <h3>Kimi</h3>
            <p class="model-description">Moonshot AI 开发的新一代大语言模型</p>
          </div>
        </div>
      </el-card>
    </div>
    <div class="coming-soon">
      <el-icon><Connection /></el-icon>
      <span>更多模型正在接入中...</span>
    </div>
  </div>
</template>

<style scoped>
.model-selector {
  width: 100%;
}

.model-cards {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin: 16px auto;
  max-width: 480px;
  width: 100%;
  opacity: 0;
  transform: translateY(20px);
  animation: slideUp 0.5s ease forwards;
}

@keyframes slideUp {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.model-card {
  width: 100%;
  height: 120px;
  cursor: pointer;
  transition: all 0.3s ease;
  opacity: 0;
  animation: fadeIn 0.3s ease forwards;
  animation-delay: calc(var(--index) * 0.1s);
}

@keyframes fadeIn {
  to {
    opacity: 1;
  }
}

.model-card:hover {
  transform: translateX(5px);
  box-shadow: var(--el-box-shadow-light);
}

.model-card.active {
  border-color: var(--el-color-primary);
  box-shadow: 0 0 10px rgba(var(--el-color-primary-rgb), 0.2);
}

.model-card-content {
  display: grid;
  grid-template-columns: 120px 1fr;
  height: 100%;
  padding: 0;
}

.model-icon-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  border-right: 1px solid var(--el-border-color-lighter);
}

.model-icon {
  width: 56px;
  height: 56px;
  margin-bottom: 0;
}

.model-info {
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 16px;
  text-align: left;
}

.model-card h3 {
  margin: 0 0 8px;
  font-size: 18px;
  color: var(--el-text-color-primary);
}

.model-description {
  margin: 0;
  font-size: 14px;
  color: var(--el-text-color-secondary);
  line-height: 1.4;
}

.coming-soon {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: 20px;
  color: var(--el-text-color-secondary);
  font-size: 14px;
  opacity: 0;
  animation: fadeIn 0.5s ease forwards;
  animation-delay: 0.6s;
}

.coming-soon .el-icon {
  font-size: 18px;
}

h2 {
  margin-bottom: 20px;
  font-size: 24px;
  color: var(--el-text-color-primary);
  opacity: 0;
  transform: translateY(-10px);
  animation: slideDown 0.3s ease forwards;
}

@keyframes slideDown {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style> 