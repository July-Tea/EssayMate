<script setup lang="ts">
import { computed } from 'vue'
import { InfoFilled } from '@element-plus/icons-vue'
import Hint from '../../assets/Hint/Hint.png'  // 导入Hint图片

const props = defineProps<{
  modelName: string,
  modelType?: string  // 添加modelType属性
}>()

const emit = defineEmits(['update:modelName'])

const handleInput = (value: string) => {
  emit('update:modelName', value)
}

// 根据模型类型计算显示内容
const modelDisplayName = computed(() => {
  if (props.modelType === 'Doubao') return '豆包';
  if (props.modelType === 'Tongyi') return '通义千问';
  if (props.modelType === 'Kimi') return 'Kimi';
  return '模型'; // 默认值
})

const placeholderText = computed(() => {
  if (props.modelType === 'Doubao') {
    return '请输入火山方舟API调用示例中的model字段值，如：doubao-1-5-pro-32k-250115';
  } else if (props.modelType === 'Tongyi') {
    return '请输入阿里云API调用示例中的model字段值，如：qwen-plus';
  } else if (props.modelType === 'Kimi') {
    return '请输入Moonshot AI的API调用示例中的model字段值，如：moonshot-v1-8k';
  }
  return '请输入模型名称';
})

const helpText = computed(() => {
  if (props.modelType === 'Doubao') {
    return '请从火山方舟平台的API调用示例中获取model字段值，格式一般为：doubao-1-5-pro-32k-250115';
  } else if (props.modelType === 'Tongyi') {
    return '请从阿里云的API调用示例中获取model字段值，例如：qwen-plus、qwen-max等';
  } else if (props.modelType === 'Kimi') {
    return '请从Moonshot AI的API调用示例中获取model字段值，例如：moonshot-v1-8k、moonshot-v1-32k等';
  }
  return '请输入相应的模型名称';
})
</script>

<template>
  <div class="model-name-input">
    <div class="input-header">
      <h3>{{ modelDisplayName }}模型名称</h3>
      <el-tooltip
        effect="light"
        placement="right"
        :show-after="100"
        :enterable="false"
        popper-class="custom-tooltip"
      >
        <template #content>
          <img :src="Hint" alt="提示" class="hint-image" />
        </template>
        <el-icon class="help-icon"><InfoFilled /></el-icon>
      </el-tooltip>
    </div>
    <el-input
      :model-value="modelName"
      :placeholder="placeholderText"
      @update:model-value="handleInput"
    />
    <p class="help-text">
      {{ helpText }}
    </p>
  </div>
</template>

<style scoped>
.model-name-input {
  width: 100%;
  margin-top: 20px;
}

.input-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-bottom: 16px;
}

.help-icon {
  font-size: 16px;
  color: var(--el-text-color-secondary);
  cursor: help;
  transition: color 0.3s ease;
  margin-top: 2px;  /* 微调图标位置，使其与文字更好地对齐 */
}

.help-icon:hover {
  color: var(--el-color-primary);
}

h3 {
  margin: 0;
  font-size: 18px;
  color: var(--el-text-color-primary);
  animation: fadeIn 0.3s ease forwards;
}

.el-input {
  max-width: 400px;
  margin: 0 auto;
  animation: slideUp 0.5s ease forwards;
}

.help-text {
  margin-top: 8px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  animation: fadeIn 0.5s ease forwards;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.hint-image {
  max-width: 500px;
  display: block;
  margin: 0 auto;
  opacity: 0.9;  /* 设置图片不透明度为 0.9 */
}

/* 添加全局样式 */
:global(.custom-tooltip) {
  background: transparent !important;
  border: none !important;
}

:global(.custom-tooltip .el-popper__arrow) {
  display: none !important;
}
</style> 