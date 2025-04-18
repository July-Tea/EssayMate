<script setup lang="ts">
import { Document, FolderOpened } from '@element-plus/icons-vue'

interface Category {
  label: string
  value: string
}

const props = defineProps<{
  categories: Category[]
  activeCategory: string
  projectCounts?: Record<string, number>
}>()

const emit = defineEmits(['update:activeCategory'])

const handleCategorySelect = (index: string) => {
  emit('update:activeCategory', index)
}

// 获取项目数量
const getProjectCount = (value: string) => {
  if (props.projectCounts && props.projectCounts[value] !== undefined) {
    return props.projectCounts[value]
  }
  return 0
}
</script>

<template>
  <el-aside width="240px" class="sidebar">
    <div class="category-section">
      <h3>项目分类</h3>
      <el-menu
        :default-active="activeCategory"
        class="category-menu"
        @select="handleCategorySelect"
      >
        <el-menu-item index="All">
          <el-icon><Document /></el-icon>
          <span>全部项目</span>
          <span class="project-count">{{ getProjectCount('All') }}</span>
        </el-menu-item>
        <el-menu-item 
          v-for="category in categories.filter(c => c.value !== 'All')"
          :key="category.value"
          :index="category.value"
        >
          <el-icon><FolderOpened /></el-icon>
          <span>{{ category.label }}</span>
          <span class="project-count">{{ getProjectCount(category.value) }}</span>
        </el-menu-item>
      </el-menu>
    </div>
  </el-aside>
</template>

<style scoped>
.sidebar {
  background: #fff;
  border-right: 1px solid rgba(0, 0, 0, 0.06);
  padding: 24px 0;
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.category-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.sidebar h3 {
  margin: 0;
  padding: 0 24px;
  font-size: 14px;
  color: rgba(0, 0, 0, 0.45);
  font-weight: 500;
}

.category-menu {
  border-right: none;
}

.category-menu :deep(.el-menu-item) {
  height: 40px;
  line-height: 40px;
  padding: 0 24px;
}

.category-menu :deep(.el-menu-item.is-active) {
  background: var(--el-color-primary-light-9);
}

.project-count {
  position: absolute;
  right: 16px;
  font-size: 12px;
  color: rgba(0, 0, 0, 0.25);
}
</style> 