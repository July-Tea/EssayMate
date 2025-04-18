import { ref } from 'vue';
import mitt from 'mitt';

/**
 * 应用全局事件类型定义
 */
type Events = {
  // 批改完成事件，包含项目ID和版本信息
  'feedback-completed': { 
    projectId: number,
    versionNumber: number,
    feedbackId: number 
  }
  // 刷新项目列表事件
  'refresh-projects': void
  // 批注事件
  'annotation:locked': { id: string | number, position: { x: number, y: number } };
  'annotation:unlocked': { id: string | number };
  'annotation:clear-all': void;
};

/**
 * 事件总线，用于非父子组件之间的通信
 * 
 * 使用示例：
 * 
 * // 在组件中引入
 * import eventBus from '@/utils/eventBus'
 * 
 * // 监听事件
 * eventBus.on('feedback-completed', (data) => {
 *   console.log(data.projectId, data.versionNumber)
 * })
 * 
 * // 触发事件
 * eventBus.emit('feedback-completed', { projectId: 1, versionNumber: 1, feedbackId: 1 })
 */
const eventBus = mitt<Events>();

// 当前锁定的批注ID
const currentLockedAnnotationId = ref<string | number | null>(null);

// 获取当前锁定的批注ID
const getLockedAnnotationId = () => currentLockedAnnotationId.value;

// 设置当前锁定的批注ID
const setLockedAnnotationId = (id: string | number | null) => {
  currentLockedAnnotationId.value = id;
};

// 锁定一个批注
const lockAnnotation = (id: string | number, position: { x: number, y: number }) => {
  // console.log(`[eventBus] 锁定批注: ${id}`);
  // console.log(`[eventBus] 当前锁定状态: ${currentLockedAnnotationId.value}`);
  
  // 先解锁当前锁定的批注（如果有）
  if (currentLockedAnnotationId.value && currentLockedAnnotationId.value !== id) {
    // console.log(`[eventBus] 先解锁当前锁定的批注: ${currentLockedAnnotationId.value}`);
    eventBus.emit('annotation:unlocked', { id: currentLockedAnnotationId.value });
  }
  
  // 设置新的锁定ID
  currentLockedAnnotationId.value = id;
  // console.log(`[eventBus] 更新锁定ID为: ${currentLockedAnnotationId.value}`);
  
  // 发送锁定事件
  eventBus.emit('annotation:locked', { id, position });
};

// 解锁一个批注
const unlockAnnotation = (id: string | number) => {
  // console.log(`[eventBus] 尝试解锁批注: ${id}`);
  // console.log(`[eventBus] 当前锁定状态: ${currentLockedAnnotationId.value}`);
  
  // 只有当前锁定的批注才能被解锁
  if (currentLockedAnnotationId.value === id) {
    // console.log(`[eventBus] 成功解锁批注: ${id}`);
    currentLockedAnnotationId.value = null;
    eventBus.emit('annotation:unlocked', { id });
  } else {
    // console.log(`[eventBus] 解锁失败，当前锁定的是: ${currentLockedAnnotationId.value}`);
  }
};

// 清除所有锁定状态
const clearAllAnnotations = () => {
  // console.log(`[eventBus] 清除所有批注锁定`);
  currentLockedAnnotationId.value = null;
  eventBus.emit('annotation:clear-all');
};

// 判断一个批注是否被锁定
const isAnnotationLocked = (id: string | number) => {
  const result = currentLockedAnnotationId.value === id;
  // console.log(`[eventBus] 检查批注 ${id} 是否锁定: ${result}`);
  return result;
};

// 判断是否有任何批注被锁定
const hasLockedAnnotation = () => {
  const result = currentLockedAnnotationId.value !== null;
  // console.log(`[eventBus] 检查是否有任何批注被锁定: ${result}, ID: ${currentLockedAnnotationId.value}`);
  return result;
};

// 为了兼容现有代码，导出eventBus
export default eventBus;

// 导出批注管理相关功能
export const annotationManager = {
  lockAnnotation,
  unlockAnnotation,
  clearAllAnnotations,
  isAnnotationLocked,
  hasLockedAnnotation,
  getLockedAnnotationId,
  setLockedAnnotationId
}; 