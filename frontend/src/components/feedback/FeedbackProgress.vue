<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch, nextTick, reactive } from 'vue'
import { ElMessage } from 'element-plus'
import { projectApi } from '@/api/project'
import { 
  Loading, 
  SuccessFilled, 
  CircleCloseFilled, 
  Close, 
  RefreshRight
} from '@element-plus/icons-vue'
import eventBus from '@/utils/eventBus'
import PinballGame from '@/components/Game/PinballGame.vue'
import ParticlesGame from '@/components/Game/ParticlesGame.vue'

// 定义枚举类型
enum FeedbackStage {
  FEEDBACK = 'FEEDBACK',  // 反馈生成阶段
  ANNOTATION = 'ANNOTATION', // 段落批注阶段
  EXAMPLE_ESSAY = 'EXAMPLE_ESSAY', // 范文生成阶段
  NONE = 'NONE',  // 未知阶段
  COMPLETED = 'COMPLETED', // 完成阶段
  FAILED = 'FAILED' // 失败阶段
}

// 状态对应的中文描述
const stageDescriptions = {
  [FeedbackStage.FEEDBACK]: '反馈生成阶段',
  [FeedbackStage.ANNOTATION]: '段落批注阶段',
  [FeedbackStage.EXAMPLE_ESSAY]: '范文生成阶段',
  [FeedbackStage.NONE]: '初始处理阶段',
  [FeedbackStage.COMPLETED]: '批改完成',
  [FeedbackStage.FAILED]: '批改失败'
}

const props = defineProps<{
  visible: boolean
  feedbackId: number
  projectId: number
  versionNumber: number
  projectTitle: string
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  'completed': [data: { feedbackId: number, projectId: number, versionNumber: number }]
  'failed': []
  'open-feedback-dialog': [data: { projectId: number, versionNumber: number, feedbackId: number }]
  'refresh-list': []
}>()

// 状态控制
const status = ref('in_progress')
const loadingStatus = ref('初始化处理...')
const pollingInterval = ref<number | null>(null)

// 轮询计数器
const pollCount = ref(0)
const maxPollCount = 60 // 最大轮询次数 (60次 * 2秒 = 2分钟)

// 文本过渡控制
const isFadingText = ref(false)

// 进度状态集中管理 - 使用响应式对象
const progressState = reactive({
  stage: FeedbackStage.FEEDBACK,       // 当前阶段
  totalItems: 0,                       // 总项目数
  currentItem: 0,                      // 当前项目
  percentage: 15,                      // 进度百分比
  statusText: '',                      // 状态文本
  isAnnotationActive: false            // 段落处理进度指示器是否激活
})

// feedback阶段的提示文字
const feedbackMessages = [
  '正在识别标题、段落结构和关键观点...',
  '正在评估语言流畅度、词汇多样性...',
  '正在生成整体评价和改进建议...'
]

// annotation阶段的提示文字
const annotationMessages = [
  '正在分析段落结构和内容...',
  '正在生成具体修改建议...',
  '正在标注语法、词汇和表达问题...'
]

// example_essay阶段的提示文字
const exampleEssayMessages = [
  '正在分析题目要求和考点...',
  '正在构思范文结构和论点...',
  '正在撰写高分范文内容...',
  '正在完善范文语言表达...'
]

// 处理文本长度保持一致
function formatProgressText(text: string, stage: FeedbackStage): string {
  // 完成和失败状态特殊处理，直接返回文本不加前缀
  if (stage === FeedbackStage.COMPLETED) {
    return text;
  }
  
  if (stage === FeedbackStage.FAILED) {
    return text;
  }
  
  // 状态值检查 - 兜底方案
  if (status.value === 'completed') {
    return '批改已完成';
  }
  
  if (status.value === 'failed') {
    return '批改过程中出现错误，请重试';
  }
  
  // 限制字符长度，确保一致性
  const maxLength = 60
  const stagePrefix = `[${stageDescriptions[stage] || '处理中'}] `
  
  // 截断过长文本
  const truncatedText = text.length > maxLength - stagePrefix.length 
    ? text.substring(0, maxLength - stagePrefix.length - 3) + '...'
    : text
    
  return stagePrefix + truncatedText
}

// 计算进度与文本
function calculateProgress(stage: FeedbackStage, totalItems: number, currentItem: number, count: number) {
  // 特殊状态处理
  if (stage === FeedbackStage.COMPLETED || status.value === 'completed') {
    return {
      text: '批改已完成',
      percentage: 100
    }
  }
  
  if (stage === FeedbackStage.FAILED || status.value === 'failed') {
    return {
      text: '处理过程中遇到了问题，请重试',
      percentage: 0
    }
  }
  
  let text = ''
  let percentage = 15
  
  if (stage === FeedbackStage.FEEDBACK) {
    // 在feedback阶段轮换显示不同的提示文字
    const messageIndex = count % feedbackMessages.length
    text = feedbackMessages[messageIndex]
    // feedback阶段，进度范围15%-45%
    percentage = 15 + Math.min(30, count)
  } else if (stage === FeedbackStage.ANNOTATION) {
    // 在annotation阶段显示段落处理进度
    if (totalItems > 0) {
      // 如果知道总段落数，显示当前段落和总段落数
      const messageIndex = count % annotationMessages.length
      text = `(正在处理第${currentItem}段，共${totalItems}段) ${annotationMessages[messageIndex]}`
      // 计算进度百分比：45%（起始）+ (当前项/总项*45%）- 分配45%给批注阶段
      const annotationProgress = Math.round((currentItem / totalItems) * 45)
      percentage = 45 + annotationProgress
    } else if (currentItem > 0) {
      // 如果不知道总段落数但知道当前段落
      const messageIndex = count % annotationMessages.length
      text = `(正在处理第${currentItem}段) ${annotationMessages[messageIndex]}`
      // 每处理一段，进度增加5%，最多到90%
      percentage = Math.min(90, 45 + (currentItem * 5))
    } else {
      // 既不知道总段落数也不知道当前段落
      const messageIndex = count % annotationMessages.length
      text = annotationMessages[messageIndex]
      percentage = 50 // 默认进度
    }
  } else if (stage === FeedbackStage.EXAMPLE_ESSAY) {
    // 在EXAMPLE_ESSAY阶段显示范文生成进度 - 分配最后10%的进度
    if (totalItems > 0) {
      // 如果知道总范文数，显示当前范文和总范文数
      const messageIndex = count % exampleEssayMessages.length
      text = `(正在生成第${currentItem}篇，共${totalItems}篇) ${exampleEssayMessages[messageIndex]}`
      // 计算进度百分比：90%（起始）+ (当前项/总项*10%）- 分配10%给范文阶段
      const exampleEssayProgress = Math.round((currentItem / totalItems) * 10)
      percentage = 90 + exampleEssayProgress
    } else if (currentItem > 0) {
      // 如果不知道总范文数但知道当前范文
      const messageIndex = count % exampleEssayMessages.length
      text = `(正在生成第${currentItem}篇) ${exampleEssayMessages[messageIndex]}`
      // 每生成一篇，进度增加2%，最多到95%
      percentage = Math.min(95, 90 + (currentItem * 2))
    } else {
      // 既不知道总范文数也不知道当前范文
      const messageIndex = count % exampleEssayMessages.length
      text = exampleEssayMessages[messageIndex]
      percentage = 92 // 默认进度
    }
  } else if (stage === FeedbackStage.NONE) {
    // 未知阶段 - 使用更通用的提示词，避免"正在处理您的作文..."这样可能与已完成状态冲突的文本
    text = '系统正在处理中...'
    percentage = 35 // 默认进度
  }
  
  // 格式化并限制文本长度
  text = formatProgressText(text, stage)
  
  // 确保进度不超过95%（预留5%给完成状态）
  percentage = Math.min(95, percentage)
  
  return { text, percentage }
}

// 统一更新进度状态 - 原子操作
async function updateProgressState(data: any, triggerFade = false) {
  // 如果状态已经是completed或failed，不再更新进度状态
  if (status.value === 'completed' || status.value === 'failed') {
    // console.log(`[进度更新] 状态已经是${status.value}，忽略后续更新`)
    return
  }
  
  // 处理有些API响应直接返回status为completed的情况
  if (data.status === 'COMPLETED' || data.status === 'completed') {
    // console.log('[进度更新] 检测到data.status为completed，直接设置完成状态')
    
    status.value = 'completed'
    loadingStatus.value = '处理完成！'
    progressState.statusText = '批改已完成'
    progressState.percentage = 100
    progressState.stage = FeedbackStage.COMPLETED
    
    return
  }
  
  // 如果需要文本过渡效果，先标记淡出
  if (triggerFade && progressState.stage !== data.currentStage && data.currentStage) {
    isFadingText.value = true
    // 等待淡出完成
    await new Promise(resolve => setTimeout(resolve, 300))
  }
  
  // 更新阶段信息
  if (data.currentStage) {
    progressState.stage = data.currentStage as FeedbackStage
  }
  
  // 更新项目进度
  if (data.totalItems !== undefined) {
    progressState.totalItems = data.totalItems
  }
  
  if (data.currentItem !== undefined) {
    progressState.currentItem = data.currentItem
  }
  
  // 计算新的进度和文本
  const { text, percentage } = calculateProgress(
    progressState.stage, 
    progressState.totalItems, 
    progressState.currentItem,
    pollCount.value
  )
  
  // 更新状态
  progressState.statusText = text
  progressState.percentage = percentage
  
  // 更新段落处理进度指示器激活状态 - 设置为 false 以隐藏段落进度条
  progressState.isAnnotationActive = false
  
  // 更新阶段对应的标题
  if (progressState.stage === FeedbackStage.FEEDBACK) {
    loadingStatus.value = '正在生成批改反馈...'
  } else if (progressState.stage === FeedbackStage.ANNOTATION) {
    loadingStatus.value = '正在生成段落批注...'
  } else if (progressState.stage === FeedbackStage.EXAMPLE_ESSAY) {
    loadingStatus.value = '正在生成范文...'
  } else if (progressState.stage === FeedbackStage.COMPLETED) {
    loadingStatus.value = '处理完成！'
  } else if (progressState.stage === FeedbackStage.FAILED) {
    loadingStatus.value = '批改失败'
  } else {
    loadingStatus.value = '正在处理您的作文...'
  }
  
  // 如果有淡入效果，等待DOM更新后取消淡出状态
  if (triggerFade && isFadingText.value) {
    await nextTick()
    // 延迟一点点，确保CSS过渡效果正确触发
    setTimeout(() => {
      isFadingText.value = false
    }, 50)
  }
  
  // console.log(`[进度更新] 阶段: ${progressState.stage}, 文本: ${progressState.statusText}, 进度: ${progressState.percentage}%`)
}

// 关闭对话框
const handleClose = () => {
  emit('update:visible', false)
  
  // 如果状态是完成状态，发出刷新列表事件
  if (status.value === 'completed') {
    emit('refresh-list')
  }
}

// 修改重试函数
const handleRetry = async () => {
  try {
    loadingStatus.value = '重新提交处理请求...'
    progressState.statusText = '正在重新连接服务...'
    status.value = 'in_progress'
    
    // 直接重置所有进度状态
    progressState.stage = FeedbackStage.FEEDBACK
    progressState.percentage = 15
    progressState.totalItems = 0
    progressState.currentItem = 0
    isFadingText.value = false
    
    // 更新状态
    await updateProgressState({
      currentStage: FeedbackStage.FEEDBACK,
      totalItems: 0,
      currentItem: 0
    })
    
    // 重新调用批改服务
    const response = await projectApi.generateActiveFeedback(props.projectId, props.versionNumber, {
      useStepByStepStrategy: true,
      generateExampleEssay: true
    })
    
    if (response && response.feedbackId) {
      // 更新反馈ID并开始轮询
      startPolling(response.feedbackId)
    } else {
      throw new Error('未能获取反馈ID')
    }
  } catch (error) {
    console.error('重试处理失败:', error)
    status.value = 'failed'
    loadingStatus.value = '重试处理失败，请稍后再试'
    ElMessage.error('重试处理失败，请稍后再试')
  }
}

// 开始轮询获取批改进度
const startPolling = (feedbackId: number) => {
  if (pollingInterval.value) clearInterval(pollingInterval.value)
  
  // 如果状态已经是completed或failed，不启动轮询
  if (status.value === 'completed' || status.value === 'failed') {
    // // console.log(`[轮询] 状态已经是${status.value}，不启动轮询`)
    return
  }
  
  pollCount.value = 0
  pollingInterval.value = window.setInterval(async () => {
    try {
      // 如果状态已经是completed或failed，直接停止轮询，不再处理
      if (status.value === 'completed' || status.value === 'failed') {
        // // console.log(`[轮询] 状态已经是${status.value}，停止轮询`)
        if (pollingInterval.value) {
          clearInterval(pollingInterval.value)
          pollingInterval.value = null
        }
        return
      }
      
      // 轮询计数增加
      pollCount.value++
      
      // 获取反馈进度
      const response = await projectApi.getFeedbackProgress(feedbackId)
      
      // ======= 关键修改: 检查是否是status=completed但currentStage=NONE的情况 =======
      // 强制处理特殊情况: 后台返回status为completed但currentStage为NONE
      if (response.status === 'COMPLETED' || (response.status === 'completed' && response.currentStage === 'NONE')) {
        // // console.log('[轮询] 检测到COMPLETED状态')
        
        // 批改完成 - 只在第一次收到COMPLETED状态时执行这段逻辑
        if (status.value !== 'completed') {
          // // console.log('[轮询] 首次收到COMPLETED状态，更新UI')
          
          status.value = 'completed'
          loadingStatus.value = '处理完成！'
          progressState.statusText = '批改已完成'
          progressState.percentage = 100
          
          // 重要：完成状态使用特定的COMPLETED阶段，而不是NONE
          progressState.stage = FeedbackStage.COMPLETED
          
          // 停止轮询
          if (pollingInterval.value) {
            clearInterval(pollingInterval.value)
            pollingInterval.value = null
          }
          
          // 发出完成事件
          emit('completed', {
            feedbackId: feedbackId,
            projectId: props.projectId,
            versionNumber: props.versionNumber
          })
          
          // 发送全局事件，通知所有组件批改已完成
          eventBus.emit('feedback-completed', { 
            projectId: props.projectId, 
            versionNumber: props.versionNumber, 
            feedbackId: feedbackId 
          })
          
          // 发送刷新列表事件
          emit('refresh-list')
        } else {
          // // console.log('[轮询] 重复收到COMPLETED状态，忽略处理')
        }
      } else if (response.status === 'FAILED' || response.status === 'failed') {
        // 批改失败 - 只在第一次收到FAILED状态时执行这段逻辑
        if (status.value !== 'failed') {
          // // console.log('[轮询] 首次收到FAILED状态，更新UI')
          
          status.value = 'failed'
          loadingStatus.value = '批改失败'
          progressState.statusText = '处理过程中遇到了问题，请重试'
          progressState.percentage = 0
          
          // 重要：失败状态使用特定的FAILED阶段，而不是NONE
          progressState.stage = FeedbackStage.FAILED
          
          // 停止轮询
          if (pollingInterval.value) {
            clearInterval(pollingInterval.value)
            pollingInterval.value = null
          }
          
          // 发出失败事件
          emit('failed')
        } else {
          // // console.log('[轮询] 重复收到FAILED状态，忽略处理')
        }
      } else {
        // 进行中 - 检查阶段是否变化，需要淡入淡出效果
        const stageChanged = progressState.stage !== response.currentStage && response.currentStage

        // 确保收到的阶段值是有效的枚举值
        let validStage = response.currentStage;
        
        // 特别处理：如果currentStage是NONE但已经完成，强制使用COMPLETED阶段
        if (response.status === 'completed' && (validStage === 'NONE' || !validStage)) {
          // // console.log('[轮询] 检测到status=completed但stage=NONE，强制设置为COMPLETED阶段')
          validStage = FeedbackStage.COMPLETED;
          status.value = 'completed';
          loadingStatus.value = '处理完成！';
          progressState.statusText = '批改已完成';
        }
        
        if (validStage && !Object.values(FeedbackStage).includes(validStage)) {
          // console.warn(`收到未知的阶段值: ${validStage}，使用当前阶段值`);
          validStage = progressState.stage;
        }

        // 创建包含处理后的阶段值的数据对象
        const processedData = {
          ...response,
          currentStage: validStage || progressState.stage
        };
        
        // // console.log('处理后的数据:', processedData);
        
        // 统一更新所有进度状态，触发淡入淡出效果
        await updateProgressState(processedData, stageChanged)
      }
      
      // 检查是否超过最大轮询次数
      if (pollCount.value >= maxPollCount && status.value === 'in_progress') {
        loadingStatus.value = '批改时间过长，可能遇到了问题...'
        progressState.statusText = '服务器可能繁忙，请耐心等待'
      }
    } catch (error) {
      console.error('获取批改进度失败:', error)
      
      // 如果多次轮询失败，显示错误信息但继续轮询
      if (pollCount.value % 5 === 0) {
        progressState.statusText = formatProgressText('获取进度信息失败，但批改可能仍在进行中...', progressState.stage)
      }
    }
  }, 2000) // 每2秒轮询一次
}

// 游戏类型控制
const gameType = ref<'pinball' | 'particles'>('pinball')
const showGame = ref(false)
const gameLoaded = ref(false)

// 在组件挂载时随机选择游戏类型
onMounted(() => {
  gameType.value = Math.random() < 0.5 ? 'pinball' : 'particles'
  showGame.value = true
  if (props.feedbackId && props.visible) {
    // 只有在非完成和非失败状态下才开始轮询
    if (status.value !== 'completed' && status.value !== 'failed') {
      // console.log(`【FeedbackProgress】开始轮询，feedbackId=${props.feedbackId}`)
      startPolling(props.feedbackId)
    } else {
      // console.log(`【FeedbackProgress】状态已经是${status.value}，组件挂载时不开始轮询`)
    }
  }
})

// 组件卸载时停止轮询
onUnmounted(() => {
  if (pollingInterval.value) {
    clearInterval(pollingInterval.value)
  }
})

// 监听属性变化，当feedbackId变化时重新开始轮询
watch(() => props.feedbackId, (newFeedbackId) => {
  // console.log(`【FeedbackProgress】feedbackId变化: ${newFeedbackId}, status=${status.value}`)
  if (newFeedbackId && props.visible) {
    // 只有在非完成和非失败状态下才重新开始轮询
    if (status.value !== 'completed' && status.value !== 'failed') {
      // console.log(`【FeedbackProgress】feedbackId变化后开始轮询，feedbackId=${newFeedbackId}`)
      startPolling(newFeedbackId)
    } else {
      // console.log(`【FeedbackProgress】状态已经是${status.value}，不因feedbackId变化重新轮询`)
    }
  }
})

// 监听visible属性变化
watch(() => props.visible, (newVisible) => {
  // console.log(`【FeedbackProgress】visible变化: ${newVisible}, feedbackId=${props.feedbackId}, status=${status.value}`)
  if (newVisible && props.feedbackId) {
    // 只有在非完成和非失败状态下才重置轮询
    if (status.value !== 'completed' && status.value !== 'failed') {
      // 重置并开始轮询
      status.value = 'in_progress'
      
      // 重置进度状态
      updateProgressState({
        currentStage: FeedbackStage.FEEDBACK,
        totalItems: 0,
        currentItem: 0
      })
      
      // console.log(`【FeedbackProgress】visible变化后开始轮询，feedbackId=${props.feedbackId}`)
      startPolling(props.feedbackId)
    } else {
      // console.log(`【FeedbackProgress】状态已经是${status.value}，不重新轮询`)
    }
  } else if (!newVisible && pollingInterval.value) {
    // 停止轮询
    // console.log(`【FeedbackProgress】对话框关闭，停止轮询`)
    clearInterval(pollingInterval.value)
    pollingInterval.value = null
  }
})

// 计算状态颜色
const getStatusColor = () => {
  if (status.value === 'completed') return 'var(--el-color-success)'
  if (status.value === 'failed') return 'var(--el-color-danger)'
  return 'var(--el-color-primary)'
}

// 计算进度条指示文本
const progressText = computed(() => {
  if (status.value === 'completed') return '处理完成'
  if (status.value === 'failed') return '处理失败'
  return `${progressState.percentage}%`
})

// 计算对话框标题
const dialogTitle = computed(() => {
  if (status.value === 'completed') return '批改完成'
  if (status.value === 'failed') return '批改失败'
  return '批改进行中'
})

// 计算对话框类
const dialogClass = computed(() => {
  const classes = ['feedback-progress-dialog', 'custom-dialog']
  if (status.value === 'completed') classes.push('completed')
  if (status.value === 'failed') classes.push('failed')
  return classes
})
</script>

<template>
  <el-dialog
    :modelValue="visible"
    @update:modelValue="emit('update:visible', $event)"
    :title="''"
    width="520px"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    :show-close="false"
    @close="handleClose"
    :class="dialogClass"
    top="10vh"
    append-to-body
  >
    <div class="progress-container">
      <!-- 自定义标题 -->
      <div class="custom-header">
        <div class="title-wrapper">
          <h2>{{ dialogTitle }}</h2>
        </div>
        <div class="header-actions">
          <button 
            class="close-btn" 
            @click="handleClose"
            :title="'关闭'"
          >
            <el-icon><Close /></el-icon>
          </button>
        </div>
      </div>

      <!-- 内容区域 -->
      <div class="content-section">
        <!-- 状态信息 -->
        <div class="progress-info">
          <!-- 游戏区域容器 -->
          <div class="game-container">
            <PinballGame v-if="showGame && gameType === 'pinball'" @game-loaded="gameLoaded = true" />
            <ParticlesGame v-if="showGame && gameType === 'particles'" @game-loaded="gameLoaded = true" />
          </div>
          
          <!-- 处理状态栏 -->
          <div class="processing-status">
            <div class="status-badge" :style="{ backgroundColor: getStatusColor() }">
              <el-icon class="rotating" v-if="status === 'in_progress'">
                <Loading />
              </el-icon>
              <el-icon v-else-if="status === 'completed'">
                <SuccessFilled />
              </el-icon>
              <el-icon v-else-if="status === 'failed'">
                <CircleCloseFilled />
              </el-icon>
            </div>
            
            <div class="status-info">
              <div class="status-bar">
                <div 
                  class="status-bar-inner" 
                  :style="{ 
                    width: `${progressState.percentage}%`, 
                    backgroundColor: getStatusColor() 
                  }"
                ></div>
              </div>
              <div class="status-text" :class="{ 'fading': isFadingText }">
                <span class="status-detail">{{ progressState.statusText }}</span>
                <span class="status-percent">{{ progressText }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- 底部按钮 -->
      <div class="dialog-footer">
        <template v-if="status === 'failed'">
          <el-button 
            type="danger" 
            @click="handleRetry"
          >
            <el-icon class="btn-icon"><RefreshRight /></el-icon>
            重新处理
          </el-button>
          <el-button @click="handleClose">关闭</el-button>
        </template>
        <template v-else-if="status === 'completed'">
          <el-button 
            @click="handleClose"
          >
            关闭
          </el-button>
        </template>
        <template v-else>
          <p class="wait-message">请耐心等待，批改正在进行中...</p>
        </template>
      </div>
    </div>
  </el-dialog>
</template>

<style scoped>
@import './FeedbackProgress.css';
</style> 