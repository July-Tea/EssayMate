<script setup lang="ts">
defineProps<{
  apiKey: string
  hasError: boolean
}>()

const emit = defineEmits(['update:apiKey', 'keydown'])

const handleInput = (value: string) => {
  emit('update:apiKey', value)
}

const handleKeyDown = (event: KeyboardEvent) => {
  emit('keydown', event)
}
</script>

<template>
  <div class="api-key-input">
    <h2>配置API密钥</h2>
    <el-input
      :model-value="apiKey"
      :class="{ 'has-error': hasError }"
      placeholder="请输入API密钥"
      show-password
      @update:model-value="handleInput"
      @keydown="handleKeyDown"
    />
    <div v-if="hasError" class="error-message">
      API验证失败，请检查密钥是否正确
    </div>
  </div>
</template>

<style scoped>
.api-key-input {
  width: 100%;
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

.el-input {
  max-width: 400px;
  margin: 0 auto;
  opacity: 0;
  transform: translateY(20px);
  animation: slideUp 0.5s ease forwards;
  animation-delay: 0.2s;
}

@keyframes slideUp {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.has-error :deep(.el-input__wrapper) {
  box-shadow: 0 0 0 1px var(--el-color-danger) inset;
}

.error-message {
  color: var(--el-color-danger);
  font-size: 14px;
  margin-top: 8px;
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
</style> 