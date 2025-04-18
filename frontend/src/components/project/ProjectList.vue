<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { Plus, Document, Picture, Calendar, Star, Loading, Check } from '@element-plus/icons-vue'
import IELTSFeedbackDialog from '../feedback/IELTSFeedbackDialog.vue'
import eventBus from '@/utils/eventBus'
import { ElMessageBox } from 'element-plus'

// 添加 JSON 解析辅助函数
const parseJsonField = (field: string | undefined | any[], fieldName: string): any[] => {
  if (!field) return [];
  if (Array.isArray(field)) return field;
  if (typeof field === 'object') return [field];
  try {
    return JSON.parse(field);
  } catch (error) {
    console.warn(`解析 ${fieldName} 失败:`, error);
    return [];
  }
}

interface Project {
  id: string
  title: string
  description: string
  updatedAt: string
  category: string
  chartImage?: any
  targetScore?: string
  actualScore?: string
  content?: string
  feedback?: string
  status?: string
  score_tr?: number
  score_cc?: number
  score_lr?: number
  score_gra?: number
  overall_score?: number
  feedback_tr?: string
  feedback_cc?: string
  feedback_lr?: string
  feedback_gra?: string
  overall_feedback?: string
  annotations?: string
  improvement_suggestions?: string
  versions?: { id: number; projectId: string; versionNumber: number; content: string; wordCount: number; status: string; createdAt: string; updatedAt: string }[]
  feedbacks?: { 
    id: number; 
    projectId: string; 
    versionNumber: number; 
    status?: string;
    scoreTR?: number;
    scoreCC?: number;
    scoreLR?: number;
    scoreGRA?: number;
    feedbackTR: string; 
    feedbackCC: string; 
    feedbackLR: string; 
    feedbackGRA: string; 
    overallFeedback: string;
    annotations?: string;
  }[]
}

const props = defineProps<{
  projects: Project[]
  activeCategory: string
  categories: { label: string, value: string }[]
  loading?: boolean
}>()

const emit = defineEmits(['createProject', 'editProject', 'projectDeleted', 'refresh'])

// 添加批量选择相关的状态
const isSelectionMode = ref(false)
const selectedProjects = ref<Set<string>>(new Set())

// 切换选择模式
const toggleSelectionMode = () => {
  isSelectionMode.value = !isSelectionMode.value
  if (!isSelectionMode.value) {
    selectedProjects.value.clear()
  }
}

// 处理项目选择
const handleProjectSelect = (projectId: string) => {
  if (selectedProjects.value.has(projectId)) {
    selectedProjects.value.delete(projectId)
  } else {
    selectedProjects.value.add(projectId)
  }
}

// 批量删除选中的项目
const handleBatchDelete = async () => {
  if (selectedProjects.value.size === 0) return
  
  try {
    // 添加确认对话框
    await ElMessageBox.confirm(
      `确定要删除选中的 ${selectedProjects.value.size} 个项目吗？此操作不可恢复。`,
      '删除确认',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    // 用户确认删除，执行删除操作
    selectedProjects.value.forEach(projectId => {
      handleProjectDeleted(Number(projectId))
    })
    
    // 清除选择状态
    selectedProjects.value.clear()
    isSelectionMode.value = false
  } catch {
    // 用户取消删除，不执行任何操作
  }
}

// 根据分类获取标签
const getCategoryLabel = (value: string) => {
  const category = props.categories.find(c => c.value === value)
  return category ? category.label : '全部项目'
}

// 格式化日期
const formatDate = (date: string) => {
  const dateObj = new Date(date)
  const now = new Date()
  const diffTime = Math.abs(now.getTime() - dateObj.getTime())
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
  
  if (diffDays === 0) {
    return '今天'
  } else if (diffDays === 1) {
    return '昨天'
  } else if (diffDays < 7) {
    return `${diffDays}天前`
  } else {
    return dateObj.toLocaleDateString('zh-CN', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    })
  }
}

// 添加反馈对话框的显示状态
const feedbackDialogVisible = ref(false)
const task1FeedbackDialogVisible = ref(false)
const currentProject = ref<Project | null>(null)

// 修改handleProjectClick函数
const handleProjectClick = async (project: Project) => {
  console.log('【点击项目】准备打开项目详情:', project.id)
  
  // 直接使用传入的项目数据，不触发刷新
  currentProject.value = project;
  console.log('【使用当前项目数据】无需刷新，直接使用:', project.id)
  
  // 根据项目类型打开对应的反馈对话框
  if (currentProject.value.category === 'Writing2') {
    feedbackDialogVisible.value = true
  } else if (currentProject.value.category === 'Writing1') {
    task1FeedbackDialogVisible.value = true
  } else {
    emit('editProject', currentProject.value)
  }
}

// 处理创建项目
const handleCreateProject = () => {
  emit('createProject')
}

// 计算当前分类标题
const categoryTitle = computed(() => {
  return props.activeCategory === 'All' ? '全部项目' : getCategoryLabel(props.activeCategory)
})

// 过滤项目列表
const filteredProjects = computed(() => {
  if (props.activeCategory === 'All') {
    return props.projects
  }
  return props.projects.filter(project => project.category === props.activeCategory)
})

// 获取项目类型图标
const getProjectTypeIcon = (category: string) => {
  return category === 'Writing1' ? Picture : Document
}

// 获取项目类型名称
const getProjectTypeName = (category: string) => {
  return category === 'Writing1' ? 'Task 1' : 'Task 2'
}

// 获取最新版本的内容
const getLatestVersionContent = (project: Project) => {
  // 优先使用 versions 数组获取最新版本内容
  if (project.versions && project.versions.length > 0) {
    const latestVersion = project.versions[project.versions.length - 1];
    
    if (latestVersion.content) {
      const contentString = Array.isArray(latestVersion.content) 
        ? latestVersion.content.join('\n\n')
        : latestVersion.content;
      
      if (contentString.trim().length > 0) {
        return contentString;
      }
    }
  }
  
  // 如果没有 versions 或内容为空，fallback 到 project.content
  if (project.content && typeof project.content === 'string' && project.content.trim().length > 0) {
    return project.content;
  }
  
  // 如果所有内容都是空的，返回默认文本
  return '暂无内容';
}

// 获取反馈内容预览
const getFeedbackPreview = (content: string | undefined) => {
  if (!content) return '暂无批改内容';
  
  // 如果内容包含"暂无评分"或"暂无总体评价"，则认为是占位符内容
  if (content.includes('暂无评分') || content.includes('暂无总体评价')) {
    return '暂无批改内容';
  }
  
  // 去除内容前后的空白字符
  const trimmedContent = content.trim();
  if (trimmedContent.length === 0) {
    return '暂无批改内容';
  }
  
  // 截取前120个字符作为预览
  return trimmedContent.substring(0, 120) + (trimmedContent.length > 120 ? '...' : '');
}

// 获取实际分数（模拟阶段默认7.5）
const getActualScore = (project: Project) => {
  // 优先检查项目自身的 overall_score
  if (project.overall_score !== undefined && project.overall_score !== null) {
    return project.overall_score.toFixed(1);
  }
  
  // 其次从 feedbacks 数组中获取最新反馈的 overall_score
  if (project.feedbacks && project.feedbacks.length > 0) {
    // 获取最新的反馈
    const latestFeedback = project.feedbacks[project.feedbacks.length - 1];
    
    // 如果有任何一项分数存在（包括0分），则计算总分
    if (latestFeedback.scoreTR !== undefined || 
        latestFeedback.scoreCC !== undefined || 
        latestFeedback.scoreLR !== undefined || 
        latestFeedback.scoreGRA !== undefined) {
      // 计算四项分数的和除以4，保留一位小数
      const scoreTR = latestFeedback.scoreTR !== undefined ? latestFeedback.scoreTR : 0;
      const scoreCC = latestFeedback.scoreCC !== undefined ? latestFeedback.scoreCC : 0;
      const scoreLR = latestFeedback.scoreLR !== undefined ? latestFeedback.scoreLR : 0;
      const scoreGRA = latestFeedback.scoreGRA !== undefined ? latestFeedback.scoreGRA : 0;
      
      return ((scoreTR + scoreCC + scoreLR + scoreGRA) / 4).toFixed(1);
    }
  }
  
  // 如果所有方法都失败，返回"未评分"
  return '未评分';
}

// 处理项目删除
const handleProjectDeleted = (projectId: number) => {
  emit('projectDeleted', projectId)
}

// 处理刷新请求
const handleRefresh = (projectId?: string) => {
  console.log(`【项目列表】刷新项目数据${projectId ? '，特别关注项目：' + projectId : ''}`)
  emit('refresh')
}

// 在挂载时添加事件监听
onMounted(() => {
  // 监听反馈完成事件
  eventBus.on('feedback-completed', (event) => {
    console.log('【项目列表】接收到反馈完成事件:', event)
    // 刷新项目列表
    handleRefresh(String(event.projectId))
  })
  
  // 监听刷新项目列表事件
  eventBus.on('refresh-projects', () => {
    console.log('【项目列表】接收到刷新项目列表事件')
    handleRefresh()
  })
})

// 在卸载时移除事件监听
onUnmounted(() => {
  eventBus.off('feedback-completed')
  eventBus.off('refresh-projects')
})

// 获取最新版本的反馈
const getLatestVersionFeedback = (project: Project) => {
  // 优先使用 feedbacks 数组获取最新反馈
  if (project.feedbacks && project.feedbacks.length > 0) {
    const latestFeedback = project.feedbacks[project.feedbacks.length - 1];
    const feedbackParts = [];
    
    // 只添加非空的反馈（不包括占位符）
    if (latestFeedback.feedbackTR && !latestFeedback.feedbackTR.includes('暂无')) 
      feedbackParts.push(latestFeedback.feedbackTR);
      
    if (latestFeedback.feedbackCC && !latestFeedback.feedbackCC.includes('暂无')) 
      feedbackParts.push(latestFeedback.feedbackCC);
      
    if (latestFeedback.feedbackLR && !latestFeedback.feedbackLR.includes('暂无')) 
      feedbackParts.push(latestFeedback.feedbackLR);
      
    if (latestFeedback.feedbackGRA && !latestFeedback.feedbackGRA.includes('暂无')) 
      feedbackParts.push(latestFeedback.feedbackGRA);
      
    if (latestFeedback.overallFeedback && !latestFeedback.overallFeedback.includes('暂无')) 
      feedbackParts.push(latestFeedback.overallFeedback);
    
    // 如果有实际的反馈内容，返回它
    if (feedbackParts.length > 0) {
      return feedbackParts.join('\n\n');
    }
  }
  
  // 如果没有 feedbacks 或反馈为空，fallback 到 project.feedback
  if (project.feedback && 
      typeof project.feedback === 'string' && 
      !project.feedback.includes('暂无') &&
      project.feedback.trim().length > 0) {
    return project.feedback;
  }
  
  // 如果所有反馈都是占位符或空的，返回空字符串
  return '';
}
</script>

<template>
  <el-main class="main-content">
    <!-- 加载状态 -->
    <div v-if="loading" class="loading-container">
      <el-icon class="loading-icon" :size="48"><Loading /></el-icon>
      <p>加载项目中...</p>
    </div>
    
    <!-- 快速开始区域 -->
    <div v-else-if="projects.length === 0" class="quick-start-section">
      <div class="welcome-message">
        <h2>欢迎使用 EssayMate</h2>
        <p>开始您的智能写作之旅</p>
      </div>
      <div class="start-card" @click="handleCreateProject">
        <el-icon><Plus /></el-icon>
        <h3>新建项目</h3>
        <p>从头开始创建新的写作项目</p>
      </div>
    </div>

    <!-- 项目列表 -->
    <div v-else class="projects-section">
      <div class="section-header">
        <h2>{{ categoryTitle }}</h2>
        <div class="header-actions">
          <el-icon 
            class="action-icon" 
            :class="{ 'active': isSelectionMode }"
            @click="toggleSelectionMode"
          >
            <img src="@/assets/select.svg" alt="选择模式" />
          </el-icon>
          <el-icon 
            v-if="isSelectionMode && selectedProjects.size > 0"
            class="action-icon delete-icon"
            @click="handleBatchDelete"
          >
            <img src="@/assets/delete.svg" alt="删除" />
          </el-icon>
        </div>
      </div>

      <div class="projects-grid">
        <!-- 项目列表 -->
        <template v-if="filteredProjects.length > 0">
          <div 
            v-for="project in filteredProjects" 
            :key="project.id" 
            class="project-card"
            :class="{
              'task1-card': project.category === 'Writing1', 
              'task2-card': project.category === 'Writing2',
              'selected': selectedProjects.has(project.id)
            }"
            @click="isSelectionMode ? handleProjectSelect(project.id) : handleProjectClick(project)"
          >
            <!-- 选择框 -->
            <div v-if="isSelectionMode" class="selection-checkbox">
              <div class="checkbox" :class="{ 'checked': selectedProjects.has(project.id) }">
                <el-icon v-if="selectedProjects.has(project.id)" class="check-icon"><Check /></el-icon>
              </div>
            </div>
            
            <!-- 项目类型标签 -->
            <div class="project-type-badge" :class="project.category.toLowerCase()">
              <el-icon :size="14">
                <component :is="getProjectTypeIcon(project.category)" />
              </el-icon>
              <span>{{ getProjectTypeName(project.category) }}</span>
            </div>
            
            <!-- 项目卡片内容 -->
            <div class="project-content">
              <!-- 标题区域 -->
              <h3 class="project-title">{{ project.title }}</h3>
              
              <!-- 内容区域 - Task 1 带图表 -->
              <div v-if="project.category === 'Writing1'" class="task1-content">
                <div class="feedback-preview">
                  <p>{{ getFeedbackPreview(getLatestVersionContent(project) || getLatestVersionFeedback(project)) }}</p>
                </div>
                <div class="chart-thumbnail" :class="{ 'no-image': !project.chartImage }">
                  <template v-if="project.chartImage">
                    <img :src="project.chartImage.url" alt="图表预览" />
                  </template>
                  <template v-else>
                    <div class="no-image-placeholder">
                      <el-icon :size="32"><Picture /></el-icon>
                      <span>无图表</span>
                    </div>
                  </template>
                </div>
              </div>
              
              <!-- 内容区域 - Task 2 纯文本 -->
              <div v-else class="task2-content">
                <div class="feedback-preview">
                  <p>{{ getFeedbackPreview(getLatestVersionContent(project) || getLatestVersionFeedback(project)) }}</p>
                </div>
              </div>
            </div>
            
            <!-- 分隔线 -->
            <div class="card-divider"></div>
            
            <!-- 项目卡片底部 -->
            <div class="project-footer">
              <!-- 左侧信息 -->
              <div class="project-meta">
                <!-- 日期 -->
                <div class="meta-item date">
                  <el-icon><Calendar /></el-icon>
                  <span>{{ formatDate(project.updatedAt) }}</span>
                </div>
                
                <!-- 分数信息 -->
                <div class="scores-container">
                  <!-- 目标分数 -->
                  <div class="meta-item score target-score" v-if="project.targetScore">
                    <span class="score-label">目标</span>
                    <span class="score-value">{{ project.targetScore }}</span>
                  </div>
                  
                  <!-- 实际分数 -->
                  <div class="meta-item score actual-score">
                    <span class="score-label">得分</span>
                    <span class="score-value">{{ getActualScore(project) }}</span>
                    <el-icon class="score-icon"><Star /></el-icon>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </template>
        
        <!-- 新建项目卡片 (放在最后) -->
        <div class="project-card new-project" @click="handleCreateProject">
          <el-icon class="add-icon"><Plus /></el-icon>
          <span>新建项目</span>
        </div>
      </div>
    </div>

    <!-- Task2 对话框组件 -->
    <IELTSFeedbackDialog
      v-if="currentProject"
      v-model:visible="feedbackDialogVisible"
      :taskType="'Task2'"
      :current-project="{
        id: currentProject.id,
        title: currentProject.title,
        feedbacks: currentProject.feedbacks?.map(feedback => ({
          id: feedback.id,
          versionNumber: feedback.versionNumber,
          scoreTR: feedback.scoreTR !== undefined ? Number(feedback.scoreTR) || 0 : 0,
          scoreCC: feedback.scoreCC !== undefined ? Number(feedback.scoreCC) || 0 : 0,
          scoreLR: feedback.scoreLR !== undefined ? Number(feedback.scoreLR) || 0 : 0,
          scoreGRA: feedback.scoreGRA !== undefined ? Number(feedback.scoreGRA) || 0 : 0,
          feedbackTR: feedback.feedbackTR,
          feedbackCC: feedback.feedbackCC,
          feedbackLR: feedback.feedbackLR,
          feedbackGRA: feedback.feedbackGRA,
          overallFeedback: feedback.overallFeedback,
          annotations: feedback.annotations
        }))
      }"
      :feedback-data="{
        id: 1,
        projectId: typeof currentProject.id === 'string' ? parseInt(currentProject.id) : currentProject.id,
        essayVersionId: 1,
        versionNumber: 1,
        status: currentProject.status || 'pending',
        scores: {
          TR: currentProject.score_tr || 0,
          CC: currentProject.score_cc || 0,
          LR: currentProject.score_lr || 0,
          GRA: currentProject.score_gra || 0
        },
        overallScore: currentProject.overall_score || 0,
        feedback: {
          TR: currentProject.feedback_tr || '',
          CC: currentProject.feedback_cc || '',
          LR: currentProject.feedback_lr || '',
          GRA: currentProject.feedback_gra || '',
          overall: currentProject.overall_feedback || ''
        },
        targetScore: currentProject.targetScore,
        previousScore: 0,
        annotations: parseJsonField(currentProject.annotations, 'annotations'),
        improvementSuggestions: parseJsonField(currentProject.improvement_suggestions, 'improvement_suggestions'),
        createdAt: currentProject.updatedAt,
        updatedAt: currentProject.updatedAt
      }"
      :versions="(currentProject.versions || [{
        id: 1,
        projectId: typeof currentProject.id === 'string' ? parseInt(currentProject.id) : currentProject.id,
        versionNumber: 1,
        content: currentProject.content?.split('\n') || [],
        wordCount: currentProject.content?.split(/\s+/).length || 0,
        status: currentProject.status || 'draft',
        createdAt: currentProject.updatedAt,
        updatedAt: currentProject.updatedAt
      }]).map(version => ({
        ...version,
        projectId: typeof version.projectId === 'string' ? parseInt(version.projectId) : version.projectId,
        content: Array.isArray(version.content) ? version.content : (version.content?.split('\n') || [])
      }))"
      @delete="handleProjectDeleted"
      @refresh="handleRefresh"
    />

    <!-- 添加 Task1 对话框组件 -->
    <IELTSFeedbackDialog
      v-if="currentProject"
      v-model:visible="task1FeedbackDialogVisible"
      :taskType="'Task1'"
      :current-project="{
        id: currentProject.id,
        title: currentProject.title,
        chartImage: currentProject.chartImage,
        feedbacks: currentProject.feedbacks?.map(feedback => ({
          id: feedback.id,
          versionNumber: feedback.versionNumber,
          scoreTR: feedback.scoreTR !== undefined ? Number(feedback.scoreTR) || 0 : 0,
          scoreCC: feedback.scoreCC !== undefined ? Number(feedback.scoreCC) || 0 : 0,
          scoreLR: feedback.scoreLR !== undefined ? Number(feedback.scoreLR) || 0 : 0,
          scoreGRA: feedback.scoreGRA !== undefined ? Number(feedback.scoreGRA) || 0 : 0,
          feedbackTR: feedback.feedbackTR,
          feedbackCC: feedback.feedbackCC,
          feedbackLR: feedback.feedbackLR,
          feedbackGRA: feedback.feedbackGRA,
          overallFeedback: feedback.overallFeedback,
          annotations: feedback.annotations
        }))
      }"
      :feedback-data="{
        id: 1,
        projectId: typeof currentProject.id === 'string' ? parseInt(currentProject.id) : currentProject.id,
        essayVersionId: 1,
        versionNumber: 1,
        status: currentProject.status || 'pending',
        scores: {
          TR: currentProject.score_tr || 0,
          CC: currentProject.score_cc || 0,
          LR: currentProject.score_lr || 0,
          GRA: currentProject.score_gra || 0
        },
        overallScore: currentProject.overall_score || 0,
        feedback: {
          TR: currentProject.feedback_tr || '',
          CC: currentProject.feedback_cc || '',
          LR: currentProject.feedback_lr || '',
          GRA: currentProject.feedback_gra || '',
          overall: currentProject.overall_feedback || ''
        },
        targetScore: currentProject.targetScore,
        previousScore: 0,
        annotations: parseJsonField(currentProject.annotations, 'annotations'),
        improvementSuggestions: parseJsonField(currentProject.improvement_suggestions, 'improvement_suggestions'),
        createdAt: currentProject.updatedAt,
        updatedAt: currentProject.updatedAt
      }"
      :versions="(currentProject.versions || [{
        id: 1,
        projectId: typeof currentProject.id === 'string' ? parseInt(currentProject.id) : currentProject.id,
        versionNumber: 1,
        content: currentProject.content?.split('\n') || [],
        wordCount: currentProject.content?.split(/\s+/).length || 0,
        status: currentProject.status || 'draft',
        createdAt: currentProject.updatedAt,
        updatedAt: currentProject.updatedAt
      }]).map(version => ({
        ...version,
        projectId: typeof version.projectId === 'string' ? parseInt(version.projectId) : version.projectId,
        content: Array.isArray(version.content) ? version.content : (version.content?.split('\n') || [])
      }))"
      @delete="handleProjectDeleted"
      @refresh="handleRefresh"
    />
  </el-main>
</template>

<style scoped>
@import './ProjectList.css';

/* 批改中状态旋转图标 */
.rotating-icon {
  animation: rotate 2s linear infinite;
}

@keyframes rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* 头部操作按钮样式 */
.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-left: 16px;
}

.action-icon {
  cursor: pointer;
  opacity: 0.6;
  transition: opacity 0.2s ease;
}

.action-icon:hover {
  opacity: 1;
}

.action-icon.active {
  opacity: 1;
}

.delete-icon {
  opacity: 0.6;
}

.delete-icon:hover {
  opacity: 1;
}

/* 选择框样式 */
.selection-checkbox {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 1;
}

.checkbox {
  width: 20px;
  height: 20px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  background: white;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
}

.checkbox.checked {
  background: #409eff;
  border-color: #409eff;
}

.check-icon {
  color: white;
  font-size: 14px;
}

/* 选中状态样式 */
.project-card.selected {
  border-color: #409eff;
  background-color: rgba(64, 158, 255, 0.05);
}

.project-card.selected .chart-thumbnail {
  background-color: rgba(64, 158, 255, 0.05);
}

.project-card.selected .chart-thumbnail.no-image {
  background-color: rgba(64, 158, 255, 0.05);
}

.project-card.selected .chart-thumbnail img {
  background-color: rgba(64, 158, 255, 0.05);
}

/* 选择模式下的项目卡片样式 */
.project-card {
  position: relative;
  transition: all 0.2s ease;
}

.project-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}
</style>