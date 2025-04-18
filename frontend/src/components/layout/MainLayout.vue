<script setup lang="ts">
import { Setting, Plus } from '@element-plus/icons-vue'

defineProps<{
  title?: string
}>()

const emit = defineEmits(['createProject', 'openSettings'])

const handleCreateProject = () => {
  emit('createProject')
}

const handleOpenSettings = () => {
  emit('openSettings')
}
</script>

<template>
  <div class="main-layout">
    <!-- 顶部导航栏 -->
    <el-header class="header">
      <div class="header-left">
        <div class="logo-container">
          <img src="./../../assets/icon.svg" alt="Logo" class="logo-icon"/>
          <h1 class="logo">EssayMate</h1>
        </div>
        <slot name="header-content"></slot>
      </div>
      <div class="header-right">
        <el-button
          type="primary"
          class="new-project-btn"
          @click="handleCreateProject"
        >
          <el-icon><Plus /></el-icon>
          新建项目
        </el-button>
        <el-button
          :icon="Setting"
          circle
          class="settings-btn"
          @click="handleOpenSettings"
        />
      </div>
    </el-header>

    <!-- 主要内容区域 -->
    <el-container class="main-container">
      <slot></slot>
    </el-container>
  </div>
</template>

<style scoped>
.main-layout {
  min-height: 100vh;
  background: var(--el-bg-color-page);
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 24px;
  height: 64px;
  background: #fff;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
}

.header-left {
  display: flex;
  align-items: center;
}

.logo-container {
  display: flex;
  align-items: center;
  margin-right: 40px;
}

.logo-icon {
  height: 36px;
  width: auto;
  margin-right: 24px;
}

.logo {
  margin: 0;
  font-size: 22px;
  color: var(--el-text-color-primary);
  font-weight: 600;
  letter-spacing: -0.5px;
}

.header-right {
  display: flex;
  gap: 16px;
  align-items: center;
}

.new-project-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 38px;
  padding: 0 18px;
  border-radius: 8px;
  font-weight: 500;
  box-shadow: 0 2px 6px rgba(var(--el-color-primary-rgb), 0.2);
  transition: all 0.3s ease;
}

.new-project-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(var(--el-color-primary-rgb), 0.25);
}

.settings-btn {
  height: 38px;
  width: 38px;
  border-radius: 8px;
  transition: all 0.3s ease;
  color: rgba(0, 0, 0, 0.65);
  border: 1px solid rgba(0, 0, 0, 0.08);
}

.settings-btn:hover {
  background: rgba(0, 0, 0, 0.02);
  color: var(--el-color-primary);
  transform: translateY(-1px);
}

.main-container {
  height: calc(100vh - 64px);
}
</style> 