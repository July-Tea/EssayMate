<script setup lang="ts">
interface ExamType {
  label: string
  value: string
  enabled: boolean
  tooltip?: string
}

defineProps<{
  examTypes: ExamType[]
  activeExamType: string
}>()

const emit = defineEmits(['update:activeExamType'])

const handleExamTypeSelect = (value: string) => {
  emit('update:activeExamType', value)
}
</script>

<template>
  <div class="exam-type-selector">
    <div class="exam-tabs">
      <div 
        v-for="type in examTypes" 
        :key="type.value"
        class="exam-tab"
        :class="{ 
          'active': activeExamType === type.value,
          'disabled': !type.enabled
        }"
        @click="type.enabled && handleExamTypeSelect(type.value)"
      >
        <el-tooltip
          v-if="!type.enabled && type.tooltip"
          :content="type.tooltip"
          placement="bottom"
          effect="light"
        >
          <span>{{ type.label }}</span>
        </el-tooltip>
        <span v-else>{{ type.label }}</span>
        <div v-if="type.enabled" class="tab-indicator"></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.exam-type-selector {
  margin-left: 0;
}

.exam-tabs {
  display: flex;
  gap: 8px;
}

.exam-tab {
  position: relative;
  padding: 8px 20px;
  font-size: 15px;
  font-weight: 500;
  color: rgba(0, 0, 0, 0.65);
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.3s ease;
}

.exam-tab:hover:not(.disabled) {
  color: var(--el-color-primary);
  background: rgba(var(--el-color-primary-rgb), 0.04);
}

.exam-tab.active {
  color: var(--el-color-primary);
  background: rgba(var(--el-color-primary-rgb), 0.08);
}

.exam-tab.disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.tab-indicator {
  position: absolute;
  bottom: -1px;
  left: 50%;
  transform: translateX(-50%);
  width: 16px;
  height: 3px;
  background: var(--el-color-primary);
  border-radius: 3px 3px 0 0;
  transition: all 0.3s ease;
}
</style> 