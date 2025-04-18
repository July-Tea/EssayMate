<template>
  <teleport to="body">
    <transition name="tooltip-fade">
      <div 
        class="annotation-tooltip" 
        :style="tooltipStyle"
        @mouseenter="handleMouseEnter"
        @mouseleave="handleMouseLeave"
      >
        <!-- 精美的小箭头指示器 -->
        <div class="tooltip-arrow" :style="arrowStyle"></div>
        
        <!-- 标签栏固定，不应参与滚动 -->
        <div v-if="annotations.length > 1" class="tooltip-tabs">
          <div 
            v-for="(annotation, index) in annotations" 
            :key="index"
            class="tab-item"
            :class="{ active: activeIndex === index, [annotation.type]: true }"
            @click="handleTabClick(index)"
          >
            <div class="tab-icon" :class="annotation.type">
              <el-icon v-if="annotation.type === 'correction'"><Warning /></el-icon>
              <el-icon v-else-if="annotation.type === 'suggestion'"><InfoFilled /></el-icon>
              <el-icon v-else-if="annotation.type === 'highlight'"><Star /></el-icon>
              <el-icon v-else><Star /></el-icon>
            </div>
            <span class="tab-type">{{ getTypeLabel(annotation.type) }}</span>
          </div>
        </div>
        
        <!-- 内容区域需要单独滚动，标题栏也是固定的 -->
        <div class="tooltip-card">
          <div class="tooltip-header">
            <div class="tooltip-title">
              <div class="tooltip-badge" :class="currentAnnotation.type">
                <el-icon v-if="currentAnnotation.type === 'correction'"><Warning /></el-icon>
                <el-icon v-else-if="currentAnnotation.type === 'suggestion'"><InfoFilled /></el-icon>
                <el-icon v-else-if="currentAnnotation.type === 'highlight'"><Star /></el-icon>
                <el-icon v-else><Star /></el-icon>
              </div>
              <span class="tooltip-type" :class="currentAnnotation.type">{{ getTypeLabel(currentAnnotation.type) }}</span>
            </div>
          </div>
          
          <!-- 只有内容区域需要滚动 -->
          <div class="tooltip-content-wrapper scroll-content" :style="contentStyle">
            <transition name="card-slide" mode="out-in">
              <div :key="activeIndex" class="tooltip-content">
                <p class="error-content">{{ currentAnnotation.original_content }}</p>
                <div v-if="currentAnnotation.correction_content && currentAnnotation.type === 'correction'" class="suggestion-section">
                  <div class="suggestion-divider">
                    <span class="divider-label">修正</span>
                  </div>
                  <p class="suggestion-content">{{ currentAnnotation.correction_content }}</p>
                </div>
                <div v-if="currentAnnotation.suggestion" class="suggestion-section">
                  <div class="suggestion-divider">
                    <span class="divider-label">建议</span>
                  </div>
                  <p class="suggestion-content">{{ currentAnnotation.suggestion }}</p>
                </div>
              </div>
            </transition>
          </div>
        </div>
      </div>
    </transition>
  </teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { Warning, InfoFilled, Star } from '@element-plus/icons-vue';
import type { Annotation } from '@/types/feedback';

const props = defineProps({
  annotations: {
    type: Array as () => Annotation[],
    required: true
  },
  position: {
    type: Object as () => { x: number, y: number, position?: string },
    default: () => ({ x: 0, y: 0 })
  },
  activeIndex: {
    type: Number,
    default: 0
  }
});

const emit = defineEmits(['mouseleave', 'index-change']);

// 内部活动索引，与外部保持同步
const internalActiveIndex = ref(props.activeIndex);
// 追踪鼠标是否在卡片上
const isMouseOverCard = ref(false);

// 同步外部和内部的活动索引
watch(() => props.activeIndex, (newVal) => {
  internalActiveIndex.value = newVal;
});

// 处理鼠标进入卡片
const handleMouseEnter = () => {
  isMouseOverCard.value = true;
};

// 处理鼠标离开卡片
const handleMouseLeave = () => {
  isMouseOverCard.value = false;
  // 使用延迟确保不会与点击冲突
  setTimeout(() => {
    if (!isMouseOverCard.value) {
      emit('mouseleave');
    }
  }, 100);
};

// 处理标签点击事件
const handleTabClick = (index: number) => {
  internalActiveIndex.value = index;
  emit('index-change', index);
};

// 计算当前显示的批注
const currentAnnotation = computed(() => {
  return props.annotations[internalActiveIndex.value] || props.annotations[0];
});

// 获取批注类型标签
const getTypeLabel = (type: string) => {
  switch (type) {
    case 'correction':
      return '错误修正';
    case 'suggestion':
      return '改进建议';
    case 'highlight':
      return '重点注意';
    default:
      return '批注';
  }
};

// 计算提示框位置样式
const tooltipStyle = computed(() => {
  // 检查是否指定了在上方显示
  const isAbove = props.position.position === 'above';
  
  if (isAbove) {
    // 在元素上方显示，Y坐标减去一个偏移量
    return {
      left: `${props.position.x}px`,
      bottom: `${window.innerHeight - props.position.y + 15}px`, // 增加偏移量，确保不会遮挡元素
      top: 'auto' // 重置top值
    };
  } else {
    // 默认在元素下方显示
    return {
      left: `${props.position.x}px`,
      top: `${props.position.y + 15}px`
    };
  }
});

// 计算内容区域样式，包括最大高度和滚动
const contentStyle = computed(() => {
  // 检查是否指定了在上方显示
  const isAbove = props.position.position === 'above';
  
  // 估算固定区域（标题栏和标签栏）的高度
  let fixedHeight = 60; // 标题栏高度
  if (props.annotations.length > 1) {
    fixedHeight += 40; // 标签栏高度
  }
  
  if (isAbove) {
    // 在上方显示时，限制内容区域最大高度
    // 减去固定区域的高度，确保整个卡片不超出屏幕
    const availableHeight = props.position.y - 40; // 留出一些空间给箭头和边距
    const contentMaxHeight = Math.max(100, availableHeight - fixedHeight);
    return {
      maxHeight: `${contentMaxHeight}px` // 限制最大高度，避免超出屏幕顶部
    };
  } else {
    // 在下方显示时
    const remainingHeight = window.innerHeight - props.position.y - 30; // 计算下方剩余空间，留出空间给箭头和边距
    const contentMaxHeight = Math.max(100, remainingHeight - fixedHeight);
    return {
      maxHeight: `${contentMaxHeight}px` // 限制最大高度，避免超出屏幕底部
    };
  }
});

// 计算箭头位置样式
const arrowStyle = computed(() => {
  const isAbove = props.position.position === 'above';
  
  if (isAbove) {
    // 箭头在卡片底部，指向下方
    return {
      left: '15px',
      top: 'auto',
      bottom: '-8px', // 位于卡片底部
      transform: 'rotate(180deg)' // 旋转箭头方向
    };
  } else {
    // 默认箭头在卡片顶部，指向上方
    return {
      left: '15px',
      top: '-8px',
      bottom: 'auto'
    };
  }
});
</script>

<style>
@import './AnnotationTooltip.css';
</style> 