<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useConfigStore } from '../stores/config'
import MainLayout from '../components/layout/MainLayout.vue'
import ExamTypeSelector from '../components/exam/ExamTypeSelector.vue'
import CategorySidebar from '../components/project/CategorySidebar.vue'
import ProjectList from '../components/project/ProjectList.vue'
import SettingsDialog from '../components/settings/SettingsDialog.vue'
import IELTSProjectDialog from '../components/project/dialogs/IELTSProjectDialog.vue'
import { ElMessage } from 'element-plus'
import doubaoIcon from '../assets/model-icons/doubao-color.svg'
import qwenIcon from '../assets/model-icons/qwen.svg'
import kimiIcon from '../assets/model-icons/kimi.svg'
import { projectApi } from '../utils/api'

// 添加项目类型定义
interface Project {
  id: string
  title: string
  description: string
  updatedAt: string
  category: string
  targetScore?: string
  chartImage?: any
  content?: string
  feedback?: string
  actualScore?: string
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
  annotations?: any
  improvement_suggestions?: any
  versions?: any[]
  feedbacks?: any[]
}

// 默认选中全部项目
const activeCategory = ref('All')
const projects = ref<Project[]>([])
const configStore = useConfigStore()
const showSettingsDialog = ref(false)
// 默认选中雅思
const activeExamType = ref('IELTS')
// 显示项目创建对话框
const showProjectDialog = ref(false)
// 加载状态
const loading = ref(false)

const categories = [
  { label: '全部项目', value: 'All' },
  { label: 'Writing 1', value: 'Writing1' },
  { label: 'Writing 2', value: 'Writing2' }
]

const examTypes = [
  { label: '雅思', value: 'IELTS', enabled: true },
  { label: '托福', value: 'TOEFL', enabled: false, tooltip: '功能开发中...' },
  { label: 'GRE', value: 'GRE', enabled: false, tooltip: '功能开发中...' }
]

const aiModels = computed(() => [
  {
    key: 'doubao',
    name: 'Doubao',
    displayName: '豆包AI',
    icon: doubaoIcon,
    description: '智能写作助手，为您提供专业的写作建议',
    status: configStore.config?.model === 'Doubao' ? 'configured' : 'unconfigured'
  },
  {
    key: 'qwen',
    name: 'Tongyi',
    displayName: '通义千问',
    icon: qwenIcon,
    description: '阿里云开发的大语言模型',
    status: configStore.config?.model === 'Tongyi' ? 'configured' : 'unconfigured'
  },
  {
    key: 'kimi',
    name: 'Kimi',
    displayName: 'Kimi',
    icon: kimiIcon,
    description: 'Moonshot AI 开发的新一代大语言模型',
    status: configStore.config?.model === 'Kimi' ? 'configured' : 'unconfigured'
  }
])

// 计算项目数量
const projectCounts = computed(() => {
  const counts: Record<string, number> = {
    All: projects.value.length
  }
  
  categories.forEach(category => {
    if (category.value !== 'All') {
      counts[category.value] = projects.value.filter(p => p.category === category.value).length
    }
  })
  
  return counts
})

// 加载项目数据
const loadProjects = async () => {
  loading.value = true
  try {
    const data = await projectApi.getProjects()
    projects.value = data.map((project: any) => {
      // 处理chartImage字段
      let chartImage = project.chartImage
      if (chartImage && typeof chartImage === 'string') {
        try {
          chartImage = JSON.parse(chartImage)
        } catch (e) {
          console.error('解析chartImage失败:', e)
          chartImage = null
        }
      }
      
      // 修复：如果chartImage存在，使用base64数据而不是Blob URL
      if (chartImage && chartImage.base64) {
        chartImage.url = chartImage.base64;
      }
      
      // 创建项目对象
      return {
        id: project.id.toString(),
        title: project.title,
        description: project.prompt.substring(0, 80) + (project.prompt.length > 80 ? '...' : ''),
        content: project.prompt,
        category: project.category,
        targetScore: project.targetScore,
        actualScore: project.actualScore,
        feedback: project.feedback,
        chartImage: chartImage,
        updatedAt: project.updatedAt,
        status: project.status,
        score_tr: project.score_tr,
        score_cc: project.score_cc,
        score_lr: project.score_lr,
        score_gra: project.score_gra,
        overall_score: project.overall_score,
        feedback_tr: project.feedback_tr,
        feedback_cc: project.feedback_cc,
        feedback_lr: project.feedback_lr,
        feedback_gra: project.feedback_gra,
        overall_feedback: project.overall_feedback,
        annotations: project.annotations,
        improvement_suggestions: project.improvement_suggestions,
        // 保留版本和反馈信息
        versions: project.versions || [],
        feedbacks: project.feedbacks || []
      }
    })
  } catch (error) {
    console.error('加载项目失败:', error)
    ElMessage.error('加载项目失败，请稍后重试')
  } finally {
    loading.value = false
  }
}

const handleCreateProject = () => {
  // 根据当前选择的考试类型打开对应的对话框
  if (activeExamType.value === 'IELTS') {
    showProjectDialog.value = true
  } else {
    // 其他考试类型暂未实现
    ElMessage.info('该考试类型的功能正在开发中...')
  }
}

const handleEditProject = (project: Project) => {
  // TODO: 实现编辑项目逻辑
  console.log('编辑项目:', project)
  // 这里应该打开编辑对话框或导航到编辑页面
}

// 处理项目创建完成
const handleProjectCreated = async (project: Project, callback?: (createdProject: Project) => void) => {
  try {
    console.log('【Home组件开始处理项目创建】收到项目数据:', project)
    
    // 将项目数据保存到后端
    console.log('【准备调用后端API】创建项目请求发送中...')
    const savedProject = await projectApi.createProject({
      title: project.title,
      prompt: project.content || '',
      examType: activeExamType.value,
      category: project.category,
      targetScore: project.targetScore,
      chartImage: project.chartImage
    })
    console.log('【后端创建成功】项目已保存:', savedProject)
    
    // 获取完整的项目数据，包括反馈信息
    console.log(`【获取完整项目数据】项目ID: ${savedProject.id}`)
    const completeProjectData = await projectApi.getProject(savedProject.id.toString())
    console.log('【获取完成】完整项目数据:', completeProjectData)
    
    // 格式化获取到的完整项目数据
    const formattedProject: Project = {
      id: completeProjectData.project.id.toString(),
      title: completeProjectData.project.title,
      description: completeProjectData.project.prompt.substring(0, 100) + (completeProjectData.project.prompt.length > 100 ? '...' : ''),
      content: completeProjectData.project.prompt,
      category: completeProjectData.project.category,
      targetScore: completeProjectData.project.targetScore,
      chartImage: completeProjectData.project.chartImage,
      updatedAt: completeProjectData.project.updatedAt,
      status: completeProjectData.project.status,
      // 添加版本和反馈数组
      versions: completeProjectData.versions || [],
      feedbacks: completeProjectData.feedbacks || []
    }
    
    // 如果有反馈数据，添加到项目对象中
    if (completeProjectData.feedbacks && completeProjectData.feedbacks.length > 0) {
      console.log('【存在反馈数据】添加反馈信息到项目对象')
      const latestFeedback = completeProjectData.feedbacks[completeProjectData.feedbacks.length - 1];
      formattedProject.score_tr = latestFeedback.scoreTR;
      formattedProject.score_cc = latestFeedback.scoreCC;
      formattedProject.score_lr = latestFeedback.scoreLR;
      formattedProject.score_gra = latestFeedback.scoreGRA;
      formattedProject.overall_score = latestFeedback.overallScore;
      formattedProject.feedback_tr = latestFeedback.feedbackTR;
      formattedProject.feedback_cc = latestFeedback.feedbackCC;
      formattedProject.feedback_lr = latestFeedback.feedbackLR;
      formattedProject.feedback_gra = latestFeedback.feedbackGRA;
      formattedProject.overall_feedback = latestFeedback.overallFeedback;
      formattedProject.annotations = latestFeedback.annotations;
      formattedProject.improvement_suggestions = latestFeedback.improvementSuggestions;
    } else {
      console.log('【没有反馈数据】项目刚创建，尚无反馈')
    }
    
    // 添加到项目列表最前面
    console.log('【更新前端列表】添加项目到列表头部')
    projects.value.unshift(formattedProject)
    
    // 如果当前不是在全部项目分类，且新项目的分类与当前选中的分类不同，则切换到全部项目
    if (activeCategory.value !== 'All' && project.category !== activeCategory.value) {
      console.log(`【切换分类】从 ${activeCategory.value} 切换到 All`)
      activeCategory.value = 'All'
      ElMessage.success('项目创建成功，已切换到全部项目视图')
    } else {
      console.log('【保持当前分类】无需切换分类视图')
      ElMessage.success('项目创建成功')
    }
    
    console.log('【项目创建完成】返回创建的项目:', formattedProject)
    
    // 如果提供了回调函数，则调用回调函数并传递创建的项目数据
    if (callback && typeof callback === 'function') {
      console.log('【调用回调函数】将创建的项目数据返回给调用者')
      callback(formattedProject)
    }
    
    // 返回创建的项目对象，以便可以后续处理
    return formattedProject;
  } catch (error) {
    console.error('【项目创建失败】发生错误:', error)
    ElMessage.error('创建项目失败，请稍后重试')
    throw error; // 向上层抛出错误
  }
}

// 处理项目删除
const handleProjectDeleted = async (projectId: number) => {
  try {
    // 调用软删除 API
    await projectApi.deleteProject(projectId);
    
    // 从列表中移除已删除的项目
    projects.value = projects.value.filter(p => {
      const pId = typeof p.id === 'string' ? parseInt(p.id) : p.id;
      return pId !== projectId;
    });
    
    ElMessage.success('项目已删除');
  } catch (error) {
    console.error('删除项目失败:', error);
    ElMessage.error('删除项目失败，请稍后重试');
  }
}

onMounted(async () => {
  try {
    // 强制从后端重新加载配置，不使用任何缓存
    await configStore.loadConfig()
    
    // 加载项目数据
    await loadProjects()
  } catch (error) {
    console.error('加载配置失败:', error)
    ElMessage.error('加载配置失败，请刷新页面重试')
  }
})
</script>

<template>
  <MainLayout @create-project="handleCreateProject" @open-settings="showSettingsDialog = true">
    <template #header-content>
      <ExamTypeSelector
        :exam-types="examTypes"
        v-model:active-exam-type="activeExamType"
      />
    </template>
    
    <CategorySidebar
      :categories="categories"
      v-model:active-category="activeCategory"
      :project-counts="projectCounts"
    />
    
    <ProjectList
      :projects="projects"
      :active-category="activeCategory"
      :categories="categories"
      @create-project="handleCreateProject"
      @edit-project="handleEditProject"
      @project-deleted="handleProjectDeleted"
      @refresh="loadProjects"
      :loading="loading"
    />
  </MainLayout>
  
  <SettingsDialog
    v-model:visible="showSettingsDialog"
    :ai-models="aiModels"
  />
  
  <!-- 雅思项目创建对话框 -->
  <IELTSProjectDialog
    v-if="activeExamType === 'IELTS'"
    :visible="showProjectDialog"
    @update:visible="showProjectDialog = $event"
    :default-category="activeCategory !== 'All' ? activeCategory : undefined"
    @create-project="handleProjectCreated"
    @refresh="loadProjects"
  />
</template>

<style scoped>
/* 样式已移至各组件中 */
</style>