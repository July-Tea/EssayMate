<template>
  <div class="annotation-highlighter">
    <div v-html="processedContent" @mouseover="handleTextHover" @mouseout="handleMouseOut" @click="handleTextClick"></div>
    <AnnotationTooltip 
      v-if="activeAnnotations.length > 0" 
      :annotations="activeAnnotations"
      :position="tooltipPosition"
      :active-index="activeCardIndex"
      @index-change="onCardChange"
      @mouseleave="handleTooltipMouseLeave"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import AnnotationTooltip from './AnnotationTooltip.vue';
import type { Annotation } from '@/types/feedback';
import eventBus, { annotationManager } from '@/utils/eventBus';

const props = defineProps({
  content: {
    type: String,
    required: true
  },
  annotations: {
    type: Array as () => Annotation[],
    default: () => []
  }
});

// 为组件实例生成唯一ID，用于跟踪组件实例
// const instanceId = ref(`annotation-highlighter-${Date.now()}-${Math.floor(Math.random() * 1000)}`);

// 检测批注数据是否有重复
const checkAnnotationDuplicates = () => {
  if (!props.annotations || props.annotations.length === 0) return;
  
  // 按original_content分组
  const contentMap = new Map<string, Annotation[]>();
  
  // 收集相同内容的批注
  props.annotations.forEach((annotation, index) => {
    if (annotation.original_content) {
      const content = annotation.original_content.trim();
      if (!contentMap.has(content)) {
        contentMap.set(content, []);
      }
      contentMap.get(content)?.push({...annotation, id: index});
    }
  });
  
  // 检查是否有重复
  let hasDuplicates = false;
  contentMap.forEach((items, content) => {
    if (items.length > 1) {
      console.warn(`[警告] 检测到重复批注: "${content}" 出现了 ${items.length} 次`, items);
      hasDuplicates = true;
    }
  });
  
  if (hasDuplicates) {
    console.warn(`[警告] 批注数据存在重复，可能导致展示问题。建议检查批注生成逻辑。`);
  }
};

// 修改为支持多个批注的数组
const activeAnnotations = ref<Annotation[]>([]);
const tooltipPosition = ref({ x: 0, y: 0 });
// 添加当前活动索引，用于高亮显示
const activeCardIndex = ref(-1);
// 卡片锁定状态 - 一旦锁定，鼠标事件将不会触发新的卡片
const isCardLocked = ref(false);
// 追踪卡片是否由点击触发 - 点击触发的卡片会自动锁定
const isCardFromClick = ref(false);
// 当前激活的批注ID
const currentAnnotationId = ref<string | null>(null);
// 新增：当前锁定的全局批注ID和该组件是否持有锁
const isHoldingGlobalLock = ref(false);

// 新增：用于跟踪鼠标位置
const mousePosition = ref({ x: 0, y: 0 });
// 新增：鼠标离开卡片的距离阈值（像素）
const closeThreshold = 500; // 调整为更舒适的距离
// 新增：检查鼠标位置的计时器
const mouseTrackTimer = ref<number | null>(null);
// 新增：最后一次检查时间，用于防抖
const lastCheckTime = ref(0);
// 新增：防抖延迟（毫秒）
const debounceDelay = 100;
// 新增：启用距离检测的延迟，避免刚点击就触发检测
const enableDistanceCheckDelay = 500;
// 新增：距离检测启用时间
const distanceCheckEnabledTime = ref(0);

// 监听活动索引变化，高亮对应的批注
watch(() => activeAnnotations.value, (newValue) => {
  if (newValue.length > 0) {
    // 默认选中第一个批注
    activeCardIndex.value = 0;
    
    // 如果是点击触发的，则锁定卡片
    if (isCardFromClick.value) {
      isCardLocked.value = true;
    }
  } else {
    activeCardIndex.value = -1;
    // 重置锁定状态
    isCardLocked.value = false;
    isCardFromClick.value = false;
  }
}, { immediate: true });

// 提供给AnnotationTooltip组件的事件处理函数
const onCardChange = (index: number) => {
  activeCardIndex.value = index;
  // 锁定卡片状态
  isCardLocked.value = true;
};

// 创建批注区域映射，用于跟踪相同区域的多个批注
const annotationMap = computed(() => {
  const map: Record<string, Annotation[]> = {};
  
  // 记录已添加的批注ID，避免重复添加相同批注
  const processedIds = new Set<number>();
  
  props.annotations.forEach((annotation, index) => {
    // 确保每个批注至少有一个唯一标识
    const annotationWithId = { ...annotation, id: index };
    
    // 使用original_content作为key，保证内容的唯一性
    if (annotation.original_content && annotation.original_content.trim()) {
      const key = `content:${annotation.original_content.trim()}`;
      
      // 调试日志
      // // console.log(`创建批注映射 - 批注:`, annotationWithId);
      // // console.log(`创建批注映射 - 使用键: ${key}`);
      
      if (!map[key]) {
        map[key] = [];
      }
      
      // 避免同一个批注被多次添加到映射中
      if (!processedIds.has(index)) {
        map[key].push(annotationWithId);
        processedIds.add(index);
      }
    } else {
      console.warn(`批注 ${index} 缺少original_content内容，无法映射`);
    }
  });
  
  // // console.log('最终的批注映射:', map);
  return map;
});

// 查找单词边界
const findWordBoundary = (text: string, position: number, direction: 'forward' | 'backward') => {
  // 定义单词边界的正则表达式（空格、标点符号等）
  const boundaryRegex = /\s|[,.;:!?()[\]{}'"]/;
  
  if (direction === 'forward') {
    // 向前查找单词边界
    for (let i = position; i < text.length; i++) {
      if (boundaryRegex.test(text[i])) {
        return i;
      }
    }
    return text.length;
  } else {
    // 向后查找单词边界
    for (let i = position - 1; i >= 0; i--) {
      if (boundaryRegex.test(text[i])) {
        return i + 1;
      }
    }
    return 0;
  }
};

// 查找文本片段在内容中的位置
const findContentPositions = (content: string, searchText: string) => {
  if (!searchText || searchText.trim() === '') {
    // console.log('搜索文本为空，无法查找位置');
    return [];
  }
  
  // console.log(`查找文本: "${searchText}" 在内容中的位置`);
  const positions: { start: number, end: number }[] = [];
  
  // 尝试精确匹配
  let pos = content.indexOf(searchText);
  while (pos !== -1) {
    positions.push({
      start: pos,
      end: pos + searchText.length
    });
    // console.log(`找到位置: ${pos} - ${pos + searchText.length}`);
    pos = content.indexOf(searchText, pos + 1);
  }
  
  // 如果精确匹配失败，尝试不区分大小写的匹配
  if (positions.length === 0) {
    const lowerContent = content.toLowerCase();
    const lowerSearchText = searchText.toLowerCase();
    
    pos = lowerContent.indexOf(lowerSearchText);
    while (pos !== -1) {
      positions.push({
        start: pos,
        end: pos + lowerSearchText.length
      });
      // console.log(`找到不区分大小写的位置: ${pos} - ${pos + lowerSearchText.length}`);
      pos = lowerContent.indexOf(lowerSearchText, pos + 1);
    }
  }
  
  if (positions.length === 0) {
    // console.log('未找到匹配位置');
  }
  
  return positions;
};

// 查找清理后的内容位置
const findCleanContentPosition = (cleanedContent: string, cleanedSearchText: string) => {
  const positions: { start: number, end: number }[] = [];
  let pos = cleanedContent.toLowerCase().indexOf(cleanedSearchText.toLowerCase());
  
  while (pos !== -1) {
    positions.push({
      start: pos,
      end: pos + cleanedSearchText.length
    });
    // console.log(`找到清理后的位置: ${pos} - ${pos + cleanedSearchText.length}`);
    pos = cleanedContent.toLowerCase().indexOf(cleanedSearchText.toLowerCase(), pos + 1);
  }
  
  return positions;
};

// 查找清理后位置对应的原始位置
const findOriginalPosition = (originalText: string, cleanedText: string, cleanedPos: number) => {
  // 计算前面有多少个字符被删除了
  let originalIndex = 0;
  let cleanedIndex = 0;
  
  while (cleanedIndex < cleanedPos && originalIndex < originalText.length) {
    if (originalText[originalIndex].match(/[,.;:!?()[\]{}'"]/)) {
      // 这是被删除的字符
      originalIndex++;
    } else if (/\s/.test(originalText[originalIndex]) && /\s/.test(cleanedText[cleanedIndex])) {
      // 空白字符被保留但可能数量不一样
      while (originalIndex < originalText.length && /\s/.test(originalText[originalIndex])) {
        originalIndex++;
      }
      while (cleanedIndex < cleanedText.length && /\s/.test(cleanedText[cleanedIndex])) {
        cleanedIndex++;
      }
    } else {
      // 正常字符
      originalIndex++;
      cleanedIndex++;
    }
  }
  
  return originalIndex;
};

// 处理文本，添加带有批注ID的span标签，确保单词完整性
const processedContent = computed(() => {
  if (!props.content || props.annotations.length === 0) {
    return props.content;
  }
  
  const content = props.content;
  // console.log('处理段落内容:', content);
  // console.log('批注数量:', props.annotations.length);
  
  // 获取当前活动批注
  const activeAnnotation = activeCardIndex.value >= 0 && activeAnnotations.value.length > activeCardIndex.value
    ? activeAnnotations.value[activeCardIndex.value]
    : null;
  
  // 创建字符位置映射，记录每个位置的文本是否属于批注
  // 使用字符级映射来避免文本分段
  const charMap = new Array(content.length + 1).fill(null).map(() => ({
    annotations: [] as Annotation[],
    isActive: false,
    activeType: ''
  }));
  
  // 收集所有批注的范围
  props.annotations.forEach((annotation, index) => {
    // console.log(`处理批注 ${index}:`, annotation);
    let positions: { start: number, end: number }[] = [];
    
    // 首先检查批注是否已经带有位置信息（来自过滤器）
    if (annotation.position && 
        typeof annotation.position === 'object' && 
        'start' in annotation.position && 
        'end' in annotation.position && 
        typeof annotation.position.start === 'number' && 
        typeof annotation.position.end === 'number') {
      // 直接使用传入的位置信息
      positions = [{ 
        start: annotation.position.start, 
        end: annotation.position.end 
      }];
      // console.log(`批注 ${index} 使用传入的位置信息:`, positions[0]);
    } else {
      // 使用original_content查找位置
      const searchText = annotation.original_content.trim();
      
      // 查找位置
      if (searchText) {
        positions = findContentPositions(content, searchText);
        // 如果没有找到，尝试清理文本中的特殊字符
        if (positions.length === 0) {
          const cleanedContent = content.replace(/[,.;:!?()[\]{}'"]/g, ' ').replace(/\s+/g, ' ');
          const cleanedSearchText = searchText.replace(/[,.;:!?()[\]{}'"]/g, ' ').replace(/\s+/g, ' ');
          // console.log(`尝试使用清理后的文本查找: "${cleanedSearchText}"`);
          
          let cleanedPos = findCleanContentPosition(cleanedContent, cleanedSearchText);
          if (cleanedPos.length > 0) {
            // 将清理后找到的位置转换回原始文本位置
            positions = cleanedPos.map(pos => {
              // 从清理后的位置寻找原始位置
              let originalStart = findOriginalPosition(content, cleanedContent, pos.start);
              let originalEnd = findOriginalPosition(content, cleanedContent, pos.end);
              return {
                start: originalStart,
                end: originalEnd
              };
            });
          }
        }
      }
    }
    
    if (positions.length === 0) {
      // console.log(`批注 ${index} 未找到匹配位置`);
    }
    
    // 对找到的每个位置应用批注
    positions.forEach(position => {
      // 考虑单词边界
      const adjustedStart = findWordBoundary(content, position.start, 'backward');
      const adjustedEnd = findWordBoundary(content, position.end, 'forward');
      
      // console.log(`批注 ${index} 调整后位置: ${adjustedStart}-${adjustedEnd}`);
      
      // 添加带ID的注释，确保每个批注有一个唯一的ID
      const annotationWithId = { ...annotation, id: index };
      
      // 记录这个范围已经包含的批注键，以便在生成数据属性时保持一致性
      
      // 标记范围内的所有字符
      for (let i = adjustedStart; i < adjustedEnd; i++) {
        // 确保我们不会向同一个位置添加相同的批注两次
        if (!charMap[i].annotations.some(ann => ann.id === index)) {
          charMap[i].annotations.push(annotationWithId);
        }
        
        // 标记活动批注
        if (activeAnnotation && activeAnnotation.id === index) {
          charMap[i].isActive = true;
          charMap[i].activeType = annotation.type;
        }
      }
    });
  });
  
  // 按批注类型和活动状态分组连续字符
  const segments: {
    start: number;
    end: number;
    type: string;
    isActive: boolean;
    activeType: string;
    annotationKeys: string[];
  }[] = [];
  
  let currentSegment: {
    start: number;
    end: number;
    type: string;
    isActive: boolean;
    activeType: string;
    annotationKeys: string[];
  } | null = null;
  
  const priorityOrder = { 'correction': 0, 'suggestion': 1, 'highlight': 2, 'default': 3 };
  
  // 遍历字符映射，根据注释类型分组
  for (let i = 0; i <= content.length; i++) {
    const charInfo = charMap[i];
    
    // 确定当前字符的主要类型
    let currentType = 'default';
    let isActive = false;
    let activeType = '';
    const keys: string[] = [];
    
    if (charInfo && charInfo.annotations.length > 0) {
      // 按优先级排序批注
      const sortedAnnotations = [...charInfo.annotations].sort((a, b) => {
        const aOrder = priorityOrder[a.type as keyof typeof priorityOrder] ?? 4;
        const bOrder = priorityOrder[b.type as keyof typeof priorityOrder] ?? 4;
        return aOrder - bOrder;
      });
      
      currentType = sortedAnnotations[0].type;
      isActive = charInfo.isActive;
      activeType = charInfo.activeType;
      
      // 收集批注键 - 确保使用一致的键格式
      const collectedKeys = new Set<string>();
      
      for (const ann of charInfo.annotations) {
        // 使用original_content作为键
        collectedKeys.add(`content:${ann.original_content}`);
      }
      
      // 确保每个批注至少有一个键
      if (collectedKeys.size === 0 && charInfo.annotations.length > 0) {
        for (const ann of charInfo.annotations) {
          if (ann.id !== undefined) {
            collectedKeys.add(`id:${ann.id}`);
          }
        }
      }
      
      // 将Set转换为数组
      keys.push(...collectedKeys);
    }
    
    // 检查是否需要开始新段落
    if (!currentSegment || 
        currentSegment.type !== currentType || 
        currentSegment.isActive !== isActive || 
        (isActive && currentSegment.activeType !== activeType)) {
      
      // 结束当前段落
      if (currentSegment) {
        segments.push(currentSegment);
      }
      
      // 开始新段落
      if (i < content.length) {
        currentSegment = {
          start: i,
          end: i + 1,
          type: currentType,
          isActive: isActive,
          activeType: activeType,
          annotationKeys: keys
        };
      } else {
        currentSegment = null;
      }
    } else if (currentSegment) {
      // 继续当前段落
      currentSegment.end = i + 1;
      
      // 添加新的批注键
      for (const key of keys) {
        if (!currentSegment.annotationKeys.includes(key)) {
          currentSegment.annotationKeys.push(key);
        }
      }
    }
  }
  
  // 构建HTML结果
  let result = '';
  let lastEnd = 0;
  
  for (const segment of segments) {
    // 添加未批注的文本
    if (segment.start > lastEnd) {
      result += content.substring(lastEnd, segment.start);
    }
    
    // 添加批注文本
    if (segment.type !== 'default') {
      const segmentText = content.substring(segment.start, segment.end);
      
      // 确保annotationKeys与annotationMap中使用的相同格式
      // 从segment.annotationKeys转换为正确格式的键
      const formattedKeys: string[] = [];
      
      // 检查每个键，并确保使用完整格式
      for (const key of segment.annotationKeys) {
        // console.log(`处理批注键: ${key}`);
        
        // 如果键已经是完整格式，直接使用
        if (key.startsWith('content:') || key.startsWith('pos:') || key.startsWith('id:')) {
          formattedKeys.push(key);
        } else {
          // 尝试查找匹配的完整键
          const matchingKeys = Object.keys(annotationMap.value).filter(mapKey => 
            mapKey.includes(key)
          );
          
          if (matchingKeys.length > 0) {
            formattedKeys.push(...matchingKeys);
          } else {
            // 如果找不到匹配的，保留原始键
            formattedKeys.push(key);
          }
        }
      }
      
      // console.log(`原始键: ${segment.annotationKeys.join(', ')}`);
      // console.log(`格式化后的键: ${formattedKeys.join(', ')}`);
      
      // 对键进行排序，确保相同批注集合总是以相同顺序出现，防止闪烁
      const sortedKeys = [...new Set(formattedKeys)].sort();
      const annotationKeys = sortedKeys.join(' ');
      
      result += `<span class="annotated-text${segment.isActive ? ' active-annotation' : ''}" 
                 data-annotation-keys="${annotationKeys}" 
                 data-annotation-type="${segment.type}"
                 ${segment.isActive ? `data-active-type="${segment.activeType}"` : ''}>${segmentText}</span>`;
    } else {
      // 普通文本
      result += content.substring(segment.start, segment.end);
    }
    
    lastEnd = segment.end;
  }
  
  // 添加剩余文本
  if (lastEnd < content.length) {
    result += content.substring(lastEnd);
  }
  
  return result;
});

// 计算最佳的提示框位置，避免超出屏幕
const calculateOptimalTooltipPosition = (x: number, elementBottom: number, elementHeight: number, annotations: Annotation[]) => {
  // 获取视口高度和宽度
  const viewportHeight = window.innerHeight;
  const viewportWidth = window.innerWidth;
  
  // 预估卡片宽度 - 用于防止卡片超出屏幕右侧
  const estimatedWidth = 350; // 卡片的预估宽度
  
  // 预估卡片固定部分高度：标题栏和标签栏
  let fixedHeight = 60; // 标题栏高度
  
  // 如果有多个批注，添加标签栏高度
  if (annotations.length > 1) {
    fixedHeight += 40; // 标签栏高度
  }
  
  // 计算内容区域的预估高度
  let contentHeight = 0;
  
  // 查找具有最多内容的批注
  for (const annotation of annotations) {
    const contentLength = annotation.original_content?.length || 0;
    const suggestionLength = annotation.suggestion?.length || 0;
    const correctionLength = annotation.correction_content?.length || 0;
    
    // 更精确的文本高度计算
    // 1. 考虑每行的平均字符数 (根据UI宽度，约40-50字符/行)
    // 2. 考虑换行符的影响
    // 3. 为每个部分(原文、建议、修正)添加固定高度
    
    // 计算原始内容的行数 (考虑到内容中可能有换行符)
    const originalContentLines = contentLength > 0 
      ? annotation.original_content?.split('\n').reduce((total, line) => {
          // 每行字符数限制在30，考虑中文占位宽度更大
          return total + Math.max(1, Math.ceil(line.length / 30));
        }, 0) || 1
      : 0;
    
    // 计算建议内容的行数
    const suggestionLines = suggestionLength > 0 
      ? annotation.suggestion?.split('\n').reduce((total, line) => {
          return total + Math.max(1, Math.ceil(line.length / 30));
        }, 0) || 1
      : 0;
    
    // 计算修正内容的行数
    const correctionLines = correctionLength > 0 
      ? annotation.correction_content?.split('\n').reduce((total, line) => {
          return total + Math.max(1, Math.ceil(line.length / 30));
        }, 0) || 1
      : 0;
    
    // 每行高度约为25px，每个部分的标题大约需要35px
    const sectionHeight = 35;
    const lineHeight = 25;
    
    // 计算这个批注的内容高度
    const annotationContentHeight = 
      (originalContentLines * lineHeight) + 
      (suggestionLines > 0 ? sectionHeight + (suggestionLines * lineHeight) : 0) +
      (correctionLines > 0 ? sectionHeight + (correctionLines * lineHeight) : 0);
    
    // 更新内容区域最大高度
    contentHeight = Math.max(contentHeight, annotationContentHeight);
  }
  
  // 为内容区域添加边距和安全空间
  contentHeight += 30; // 内容区域的内边距
  
  // 计算卡片总高度 = 固定部分 + 内容区域
  const totalHeight = fixedHeight + contentHeight;
  
  // 设置最小高度，确保卡片不会过小
  // const minHeight = 200;
  // const safeHeight = Math.max(totalHeight, minHeight);
  
  // 计算下方剩余空间
  const bottomSpace = viewportHeight - elementBottom - 30; // 减去箭头和边距的空间
  // 计算上方剩余空间
  const topSpace = elementBottom - elementHeight - 30; // 减去箭头和边距的空间
  
  // 添加调试信息
  // console.log(`计算提示框位置 - 视口高度: ${viewportHeight}px, 元素底部: ${elementBottom}px`);
  // console.log(`计算提示框位置 - 下方剩余空间: ${bottomSpace}px, 上方剩余空间: ${topSpace}px`);
  // console.log(`计算提示框位置 - 固定部分高度: ${fixedHeight}px, 内容高度: ${contentHeight}px`);
  // console.log(`计算提示框位置 - 预估总高度: ${safeHeight}px`);
  
  // 主要判断逻辑: 
  // 1. 优先在下方显示，如果有足够空间
  // 2. 如果下方空间不足，但上方有足够空间，则在上方显示
  // 3. 如果上下都没有足够空间，选择空间较大的一方
  let showBelow = true;
  
  // 计算所需的最小空间，包括安全边际
  const safetyMargin = 20; // 固定安全边际（像素）
  const requiredSpace = totalHeight + safetyMargin;
  
  if (bottomSpace >= requiredSpace) {
    // 下方有足够空间，使用下方
    showBelow = true;
  } else if (topSpace >= requiredSpace) {
    // 下方空间不足，但上方有足够空间
    showBelow = false;
  } else {
    // 上下都没有足够空间，选择较大的一方
    showBelow = (bottomSpace > topSpace);
  }
  
  // console.log(`计算提示框位置 - 所需空间: ${requiredSpace}px, 决定显示在${showBelow ? '下方' : '上方'}`);
  
  // 调整X坐标，防止超出屏幕右侧
  let adjustedX = x;
  // 如果tooltip会超出右侧屏幕边界，向左偏移
  if (x + estimatedWidth > viewportWidth) {
    adjustedX = Math.max(10, viewportWidth - estimatedWidth - 10);
  }
  
  // 返回最佳位置
  if (showBelow) {
    // 在下方显示，增加一小部分向下的偏移量，避免遮挡内容
    return { 
      x: adjustedX, 
      y: elementBottom + 5 
    };
  } else {
    // 在上方显示，减去一个小的偏移量，避免紧贴元素
    const elementTop = elementBottom - elementHeight;
    return { 
      x: adjustedX,
      y: elementTop - 5, // 增加一些偏移，避免遮挡内容
      position: 'above' // 添加标记，表示卡片显示在上方
    };
  }
};

// 处理鼠标悬浮事件
const handleTextHover = (event: MouseEvent) => {
  // 如果卡片已锁定或有全局锁定，完全忽略所有鼠标悬浮事件
  if (isCardLocked.value || annotationManager.hasLockedAnnotation()) return;
  
  const target = event.target as HTMLElement;
  if (target.classList.contains('annotated-text')) {
    const annotationKeys = target.getAttribute('data-annotation-keys');
    if (annotationKeys) {
      // 添加调试日志
      // console.log('Hover - 完整的批注键值:', annotationKeys);
      // console.log('Hover - Available map keys:', Object.keys(annotationMap.value));
      
      // 检查是否已经显示了相同的批注组合 - 使用exact match而非contains比较
      // 这样防止不同但有重叠的批注集导致鼠标移动时的闪烁
      if (currentAnnotationId.value === annotationKeys) return;
      
      // 跟踪已添加的批注ID，防止重复添加
      const addedAnnotationIds = new Set<number>();
      
      // 合并所有相关批注
      const allAnnotations: Annotation[] = [];
      
      // 拆分批注键（可能包含多个键，用空格分隔）
      const keyArray = annotationKeys.split(' ');
      // console.log('Hover - 拆分后的键数组:', keyArray);
      
      // 为了解决闪烁问题：无条件收集所有相关批注，确保重叠区域的批注都被一次性加载
      for (const key of keyArray) {
        // 精确匹配
        if (annotationMap.value[key]) {
          // 对于精确匹配的键，添加其对应的所有批注（避免重复）
          for (const annotation of annotationMap.value[key]) {
            if (annotation.id !== undefined && !addedAnnotationIds.has(annotation.id)) {
              addedAnnotationIds.add(annotation.id);
              allAnnotations.push(annotation);
            }
          }
        } else if (key.startsWith('content:')) {
          // 如果精确匹配失败，尝试查找包含这个键的完整键（但条件更严格）
          const matchingKeys = Object.keys(annotationMap.value).filter(mapKey => 
            (key.startsWith('content:') && mapKey === key) ||
            // 对于模糊匹配，要求两边都是content:格式且内容高度相似
            (mapKey.startsWith('content:') && key.startsWith('content:') && 
             (mapKey.includes(key) || key.includes(mapKey)))
          );
            
          // console.log('Hover - 模糊匹配到的键:', matchingKeys);
            
          for (const matchKey of matchingKeys) {
            for (const annotation of annotationMap.value[matchKey]) {
              if (annotation.id !== undefined && !addedAnnotationIds.has(annotation.id)) {
                addedAnnotationIds.add(annotation.id);
                allAnnotations.push(annotation);
              }
            }
          }
        }
      }
      
      // 添加防闪烁优化：创建一个稳定的ID组合，确保相同位置的批注集始终有一致的ID
      // 这会确保鼠标在重叠区域移动时不会触发重新渲染
      const stableAnnotationId = keyArray.sort().join(' ');
      
      // console.log('Hover - 找到的批注:', allAnnotations.length, '已去重');
      
      // 如果没有找到任何批注，不要更新状态
      if (allAnnotations.length === 0) return;
      
      // 再次检查是否有全局锁定 - 防止在处理过程中状态变化
      if (annotationManager.hasLockedAnnotation()) return;
      
      // 清除任何现有未锁定的卡片 - 确保只有一个卡片显示
      if (!isCardLocked.value && !isHoldingGlobalLock.value) {
        // 更新当前激活的批注ID，使用稳定ID
        currentAnnotationId.value = stableAnnotationId;
        
        // 更新批注和位置
        activeAnnotations.value = allAnnotations;
        
        // 计算提示框位置 - 使用新方法计算最佳位置
        const rect = target.getBoundingClientRect();
        tooltipPosition.value = calculateOptimalTooltipPosition(event.clientX, rect.bottom, rect.height, allAnnotations);
      }
    }
  }
};

// 处理文本点击事件 - 分离点击逻辑，避免与悬停逻辑混淆
const handleTextClick = (event: MouseEvent) => {
  // console.log('==== 点击事件触发 ====');
  const target = event.target as HTMLElement;
  if (target.classList.contains('annotated-text')) {
    // console.log('点击了批注文本');
    const annotationKeys = target.getAttribute('data-annotation-keys');
    if (annotationKeys) {
      // 添加调试日志
      // console.log('Click - 完整的批注键值:', annotationKeys);
      // console.log('Click - Available map keys:', Object.keys(annotationMap.value));
      // console.log('当前组件是否持有全局锁:', isHoldingGlobalLock.value);
      // console.log('当前是否有全局锁定:', annotationManager.hasLockedAnnotation());
      // console.log('当前锁定的批注ID:', annotationManager.getLockedAnnotationId());
      // console.log('当前组件批注ID:', currentAnnotationId.value);
      
      // 跟踪已添加的批注ID，防止重复添加
      const addedAnnotationIds = new Set<number>();
      
      // 合并所有相关批注
      const allAnnotations: Annotation[] = [];
      
      // 拆分批注键（可能包含多个键，用空格分隔）
      const keyArray = annotationKeys.split(' ');
      // console.log('Click - 拆分后的键数组:', keyArray);
      
      // 为了解决闪烁问题：无条件收集所有相关批注，确保重叠区域的批注都被一次性加载
      for (const key of keyArray) {
        // 精确匹配
        if (annotationMap.value[key]) {
          // 对于精确匹配的键，添加其对应的所有批注（避免重复）
          for (const annotation of annotationMap.value[key]) {
            if (annotation.id !== undefined && !addedAnnotationIds.has(annotation.id)) {
              addedAnnotationIds.add(annotation.id);
              allAnnotations.push(annotation);
            }
          }
        } else if (key.startsWith('content:')) {
          // 如果精确匹配失败，尝试查找包含这个键的完整键（但条件更严格）
          const matchingKeys = Object.keys(annotationMap.value).filter(mapKey => 
            (key.startsWith('content:') && mapKey === key) ||
            // 对于模糊匹配，要求两边都是content:格式且内容高度相似
            (mapKey.startsWith('content:') && key.startsWith('content:') && 
             (mapKey.includes(key) || key.includes(mapKey)))
          );
            
          // console.log('Click - 模糊匹配到的键:', matchingKeys);
            
          for (const matchKey of matchingKeys) {
            for (const annotation of annotationMap.value[matchKey]) {
              if (annotation.id !== undefined && !addedAnnotationIds.has(annotation.id)) {
                addedAnnotationIds.add(annotation.id);
                allAnnotations.push(annotation);
              }
            }
          }
        }
      }
      
      // 添加防闪烁优化：创建一个稳定的ID组合，确保相同位置的批注集始终有一致的ID
      const stableAnnotationId = keyArray.sort().join(' ');
      
      // console.log('Click - 找到的批注:', allAnnotations.length, '已去重');
      // console.log('生成的稳定批注ID:', stableAnnotationId);
      
      // 如果没有找到任何批注，不要更新状态
      if (allAnnotations.length === 0) {
        // console.log('未找到批注，不更新状态');
        return;
      }
      
      // 检查是否点击了当前已锁定的批注
      if (isHoldingGlobalLock.value && currentAnnotationId.value === stableAnnotationId) {
        // 如果点击了自己已经锁定的批注，则解除锁定
        // console.log('点击了自己已锁定的批注，解除锁定');
        clearAnnotationCard();
        return;
      }
      
      // 如果有其他批注已被锁定（包括其他组件锁定的批注），先解锁
      if (annotationManager.hasLockedAnnotation()) {
        // console.log('有其他批注已被锁定，先解锁:', annotationManager.getLockedAnnotationId());
        // 如果是自己锁定的，使用自己的方法解锁
        if (isHoldingGlobalLock.value && currentAnnotationId.value) {
          // console.log('释放自己锁定的批注:', currentAnnotationId.value);
          clearAnnotationCard();
        } else {
          // 如果是其他组件锁定的，使用全局方法解锁
          // console.log('通知全局解锁批注:', annotationManager.getLockedAnnotationId());
          annotationManager.clearAllAnnotations();
        }
      }
      
      // 锁定新的批注
      // console.log('锁定新批注:', stableAnnotationId);
      
      // 更新当前激活的批注ID，使用稳定ID
      currentAnnotationId.value = stableAnnotationId;
      
      // 通知全局事件总线锁定新的批注
      const rect = target.getBoundingClientRect();
      annotationManager.lockAnnotation(stableAnnotationId, {
        x: event.clientX,
        y: rect.bottom
      });
      
      // 标记该组件持有全局锁
      isHoldingGlobalLock.value = true;
      
      // 锁定卡片状态
      isCardLocked.value = true;
      isCardFromClick.value = true;
      
      // console.log('设置锁定状态 - isCardLocked:', isCardLocked.value);
      // console.log('设置来源状态 - isCardFromClick:', isCardFromClick.value);
      // console.log('设置全局锁持有状态 - isHoldingGlobalLock:', isHoldingGlobalLock.value);
      
      // 开始鼠标跟踪，重置启用时间
      distanceCheckEnabledTime.value = Date.now();
      startMouseTracking();
      
      // 更新批注和位置
      activeAnnotations.value = allAnnotations;
      
      // 计算提示框位置 - 使用新方法计算最佳位置
      tooltipPosition.value = calculateOptimalTooltipPosition(event.clientX, rect.bottom, rect.height, allAnnotations);
    }
  } else {
    // console.log('点击的不是批注文本');
  }
};

// 清除批注卡片的所有状态
const clearAnnotationCard = () => {
  // console.log('==== 清除批注卡片 ====');
  // console.log('清除前状态 - isCardLocked:', isCardLocked.value);
  // console.log('清除前状态 - isHoldingGlobalLock:', isHoldingGlobalLock.value);
  // console.log('清除前状态 - currentAnnotationId:', currentAnnotationId.value);
  
  // 如果持有全局锁，则释放它
  if (isHoldingGlobalLock.value && currentAnnotationId.value) {
    // console.log('释放全局锁:', currentAnnotationId.value);
    isHoldingGlobalLock.value = false;
    annotationManager.unlockAnnotation(currentAnnotationId.value);
  }
  
  isCardLocked.value = false;
  isCardFromClick.value = false;
  currentAnnotationId.value = null;
  activeAnnotations.value = [];
  
  // console.log('清除后状态 - isCardLocked:', isCardLocked.value);
  // console.log('清除后状态 - isHoldingGlobalLock:', isHoldingGlobalLock.value);
  // console.log('清除后状态 - currentAnnotationId:', currentAnnotationId.value);
};

// 处理鼠标移出事件
const handleMouseOut = (event: MouseEvent) => {
  // 如果卡片已锁定，不处理移出事件
  if (isCardLocked.value || annotationManager.hasLockedAnnotation()) return;
  
  const target = event.target as HTMLElement;
  const relatedTarget = event.relatedTarget as HTMLElement | null;
  
  // 检查鼠标是否从高亮文本移出且不是移入到另一个高亮文本或提示框
  if (target.classList.contains('annotated-text')) {
    if (!relatedTarget || 
        (!relatedTarget.classList.contains('annotated-text') && 
         !relatedTarget.closest('.annotation-tooltip'))) {
      // 鼠标移出高亮文本且不是移入提示框或其他高亮文本 - 隐藏提示框
      // console.log('鼠标移出高亮文本，隐藏提示框');
      hideTooltip();
    }
  }
};

// 监听全局点击事件，处理卡片以外区域的点击
const handleDocumentClick = (event: MouseEvent) => {
  const target = event.target as HTMLElement;
  
  // 如果点击了批注文本或卡片内部，不需要处理
  if (target.classList.contains('annotated-text') || target.closest('.annotation-tooltip')) {
    return;
  }
  
  // 点击了其他区域，无论锁定与否都清除所有状态
  clearAnnotationCard();
};

// 处理全局批注锁定事件
const handleGlobalAnnotationLocked = (data: { id: string | number, position: { x: number, y: number } }) => {
  // console.log(`[${instanceId.value}] 收到全局批注锁定事件，ID:`, data.id);
  // console.log(`[${instanceId.value}] 当前组件批注ID:`, currentAnnotationId.value);
  // console.log(`[${instanceId.value}] 当前是否持有全局锁:`, isHoldingGlobalLock.value);
  
  // 如果不是该组件锁定的批注，则清除自己的批注卡片
  if (currentAnnotationId.value !== data.id) {
    // console.log(`[${instanceId.value}] 其他组件锁定了批注，清除自己的批注卡片`);
    clearAnnotationCard();
  } else {
    // console.log(`[${instanceId.value}] 是自己锁定的批注，不需要操作`);
  }
};

// 处理全局批注解锁事件
const handleGlobalAnnotationUnlocked = (data: { id: string | number }) => {
  // console.log(`[${instanceId.value}] 收到全局批注解锁事件，ID:`, data.id);
  // console.log(`[${instanceId.value}] 当前组件批注ID:`, currentAnnotationId.value);
  // console.log(`[${instanceId.value}] 当前是否持有全局锁:`, isHoldingGlobalLock.value);
  
  // 如果是该组件锁定的批注被解锁了，则清除自己的状态
  if (currentAnnotationId.value === data.id && isHoldingGlobalLock.value) {
    // console.log(`[${instanceId.value}] 自己锁定的批注被解锁，清除状态`);
    isHoldingGlobalLock.value = false;
    clearAnnotationCard();
  } else {
    // console.log(`[${instanceId.value}] 不是自己锁定的批注，不需要操作`);
  }
};

// 处理清除所有批注事件
const handleGlobalAnnotationClearAll = () => {
  // console.log(`[${instanceId.value}] 收到清除所有批注事件`);
  // console.log(`[${instanceId.value}] 当前是否持有全局锁:`, isHoldingGlobalLock.value);
  
  isHoldingGlobalLock.value = false;
  clearAnnotationCard();
};

// 在组件挂载时添加点击事件监听器和全局事件监听
onMounted(() => {
  checkAnnotationDuplicates();
  document.addEventListener('click', handleDocumentClick);
  
  // 添加全局事件监听
  eventBus.on('annotation:locked', handleGlobalAnnotationLocked);
  eventBus.on('annotation:unlocked', handleGlobalAnnotationUnlocked);
  eventBus.on('annotation:clear-all', handleGlobalAnnotationClearAll);
});

// 在组件卸载前移除点击事件监听器和全局事件监听
onBeforeUnmount(() => {
  document.removeEventListener('click', handleDocumentClick);
  
  // 停止鼠标位置跟踪
  stopMouseTracking();
  
  // 如果持有全局锁，释放它
  if (isHoldingGlobalLock.value && currentAnnotationId.value) {
    annotationManager.unlockAnnotation(currentAnnotationId.value);
  }
  
  // 移除全局事件监听
  eventBus.off('annotation:locked', handleGlobalAnnotationLocked);
  eventBus.off('annotation:unlocked', handleGlobalAnnotationUnlocked);
  eventBus.off('annotation:clear-all', handleGlobalAnnotationClearAll);
});

// 监听props.annotations变化，检查新的批注数据
watch(() => props.annotations, () => {
  checkAnnotationDuplicates();
}, { immediate: true });

// 隐藏提示框
const hideTooltip = () => {
  // 如果卡片是锁定状态或者有全局锁定，不做任何处理
  if (isCardLocked.value || isHoldingGlobalLock.value) {
    return;
  }
  
  // 非锁定状态下，重置所有状态，确保卡片消失
  clearAnnotationCard();
};

// 处理提示框的鼠标离开事件
const handleTooltipMouseLeave = () => {
  // 如果不是锁定状态且没有全局锁定，则隐藏提示框
  if (!isCardLocked.value && !isHoldingGlobalLock.value) {
    // console.log('提示框鼠标离开，非锁定状态，隐藏提示框');
    hideTooltip();
  }
};

// 更新鼠标位置并检查是否需要关闭卡片
const updateMousePosition = (event: MouseEvent) => {
  // 更新鼠标位置
  mousePosition.value = { x: event.clientX, y: event.clientY };
  
  // 使用防抖优化，避免频繁检查
  const now = Date.now();
  if (now - lastCheckTime.value < debounceDelay) return;
  lastCheckTime.value = now;
  
  // 只有在卡片锁定的状态下才检查距离
  if ((isCardLocked.value || isHoldingGlobalLock.value) && activeAnnotations.value.length > 0) {
    // 在启用延迟期间不检查距离，避免刚点击就触发关闭
    if (now - distanceCheckEnabledTime.value > enableDistanceCheckDelay) {
      checkMouseDistance();
    }
  }
};

// 检查鼠标与卡片的距离，如果超过阈值则关闭卡片
const checkMouseDistance = () => {
  if (!activeAnnotations.value.length) return;
  
  // 获取卡片元素
  const tooltipEl = document.querySelector('.annotation-tooltip') as HTMLElement;
  if (!tooltipEl) return;
  
  // 计算卡片的边界矩形
  const rect = tooltipEl.getBoundingClientRect();
  
  // 计算鼠标到卡片边界的最短距离
  let dx = 0;
  let dy = 0;
  
  // 水平方向距离
  if (mousePosition.value.x < rect.left) {
    dx = rect.left - mousePosition.value.x;
  } else if (mousePosition.value.x > rect.right) {
    dx = mousePosition.value.x - rect.right;
  }
  
  // 垂直方向距离
  if (mousePosition.value.y < rect.top) {
    dy = rect.top - mousePosition.value.y;
  } else if (mousePosition.value.y > rect.bottom) {
    dy = mousePosition.value.y - rect.bottom;
  }
  
  // 如果鼠标在卡片内部，距离为0
  // 如果鼠标在卡片外部，使用欧几里得距离（平方根）计算实际距离
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  // 仅在调试模式下打印距离，避免日志过多
  if (distance > closeThreshold * 0.5) {
    // console.log(`鼠标到卡片距离: ${Math.round(distance)}px, 阈值: ${closeThreshold}px`);
  }
  
  // 如果距离超过阈值，关闭卡片
  if (distance > closeThreshold) {
    // console.log(`鼠标距离卡片超过${closeThreshold}px，自动关闭`);
    clearAnnotationCard();
  }
};

// 开始监听鼠标移动
const startMouseTracking = () => {
  // 如果已经有计时器，先清除
  if (mouseTrackTimer.value !== null) {
    clearInterval(mouseTrackTimer.value);
  }
  
  // 记录启用距离检测的时间
  distanceCheckEnabledTime.value = Date.now();
  
  // 设置一个新的计时器，定期检查鼠标位置
  mouseTrackTimer.value = window.setInterval(() => {
    // 只有在有锁定的批注时才检查
    if ((isCardLocked.value || isHoldingGlobalLock.value) && activeAnnotations.value.length > 0) {
      if (Date.now() - distanceCheckEnabledTime.value > enableDistanceCheckDelay) {
        checkMouseDistance();
      }
    } else {
      // 如果没有锁定的批注，停止跟踪
      stopMouseTracking();
    }
  }, 300); // 每300毫秒检查一次
  
  // 添加鼠标移动事件监听器
  document.addEventListener('mousemove', updateMousePosition);
  
  // console.log('开始鼠标位置跟踪');
};

// 停止监听鼠标移动
const stopMouseTracking = () => {
  if (mouseTrackTimer.value !== null) {
    clearInterval(mouseTrackTimer.value);
    mouseTrackTimer.value = null;
  }
  
  document.removeEventListener('mousemove', updateMousePosition);
  // console.log('停止鼠标位置跟踪');
};

// 修改锁定状态监听，当批注被锁定时开始跟踪鼠标位置
watch([isCardLocked, isHoldingGlobalLock], ([newCardLocked, newHoldingLock]) => {
  if (newCardLocked || newHoldingLock) {
    // console.log('批注已锁定，开始跟踪鼠标位置');
    startMouseTracking();
  } else {
    // console.log('批注已解锁，停止跟踪鼠标位置');
    stopMouseTracking();
  }
});
</script>

<style scoped>
@import './AnnotationHighlighter.css';
</style> 