<script setup lang="ts">
// 无需任何 props 或 emits
</script>

<template>
  <div class="setup-complete">
    <h2>配置完成</h2>
    <p>恭喜！您已完成所有配置。</p>
  </div>
</template>

<style scoped>
.setup-complete {
  width: 100%;
  text-align: center;
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

p {
  font-size: 16px;
  color: var(--el-text-color-secondary);
  opacity: 0;
  animation: fadeIn 0.5s ease forwards;
  animation-delay: 0.2s;
}

@keyframes fadeIn {
  to {
    opacity: 1;
  }
}
</style> 