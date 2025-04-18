<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { UploadFilled, Delete, Check, Close, Search } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import type { UploadFile, UploadUserFile, UploadProps, UploadRequestOptions } from 'element-plus'
import { projectApi } from '@/api/project'
import FeedbackProgress from '../../feedback/FeedbackProgress.vue'
import { useConfigStore } from '@/stores/config'

interface ProjectFormData {
  writingType: string
  targetScore: number
  title: string
  content: string
  chartImage?: UploadUserFile
}

const props = defineProps<{
  visible: boolean
  defaultCategory?: string
}>()

const emit = defineEmits(['update:visible', 'create-project', 'refresh'])

// 对话框可见性
const dialogVisible = computed({
  get: () => props.visible,
  set: (val) => emit('update:visible', val)
})

// 表单数据
const formData = ref<ProjectFormData>({
  writingType: props.defaultCategory && ['Writing1', 'Writing2'].includes(props.defaultCategory) 
    ? props.defaultCategory 
    : 'Writing1',
  targetScore: 7.0,
  title: '',
  content: '',
})

// 处理默认分类变化
watch(() => props.defaultCategory, (newVal) => {
  if (newVal && ['Writing1', 'Writing2'].includes(newVal)) {
    formData.value.writingType = newVal
  }
})

// 表单引用
const formRef = ref()

// 上传图片
const chartImage = ref<UploadUserFile[]>([])

// 上传图片前的验证
const beforeUpload: UploadProps['beforeUpload'] = (file) => {
  const isImage = file.type.startsWith('image/')
  const isLt2M = file.size / 1024 / 1024 < 2

  if (!isImage) {
    ElMessage.error('只能上传图片文件!')
    return false
  }
  if (!isLt2M) {
    ElMessage.error('图片大小不能超过 2MB!')
    return false
  }
  return true
}

// 处理上传成功
const handleUploadSuccess = (_response: any, uploadFile: UploadFile) => {
  // 创建一个本地预览URL
  const fileURL = URL.createObjectURL(uploadFile.raw!)
  
  // 压缩并将图片转换为Base64格式
  const compressAndConvertToBase64 = (file: File) => {
    return new Promise<string>((resolve) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const img = new Image()
        img.onload = () => {
          // 创建canvas用于压缩
          const canvas = document.createElement('canvas')
          // 计算压缩后的尺寸，最大宽度为800px
          let width = img.width
          let height = img.height
          const maxWidth = 800
          
          if (width > maxWidth) {
            const ratio = maxWidth / width
            width = maxWidth
            height = height * ratio
          }
          
          canvas.width = width
          canvas.height = height
          
          // 绘制图片到canvas
          const ctx = canvas.getContext('2d')
          ctx?.drawImage(img, 0, 0, width, height)
          
          // 转换为base64，使用较低的质量
          const quality = 0.7 // 70%的质量，可以根据需要调整
          const base64Data = canvas.toDataURL('image/jpeg', quality)
          resolve(base64Data)
        }
        img.src = e.target?.result as string
      }
      reader.readAsDataURL(file)
    })
  }
  
  if (uploadFile.raw) {
    compressAndConvertToBase64(uploadFile.raw).then(base64Data => {
      const fileWithData = {
        name: uploadFile.name,
        url: fileURL,
        size: uploadFile.size,
        type: 'image/jpeg', // 统一使用jpeg格式
        base64: base64Data
      }
      
      chartImage.value = [{ ...uploadFile, url: fileURL }]
      formData.value.chartImage = fileWithData
    })
  }
}

// 处理上传移除
const handleRemove = () => {
  chartImage.value = []
  formData.value.chartImage = undefined
  // 更新上传组件的 key 以强制重新渲染
  uploadKey.value = Date.now()
}

// 分数选项
const scoreOptions = [
  { value: 6.0, label: '6.0', description: '基础水平' },
  { value: 6.5, label: '6.5', description: '中等水平' },
  { value: 7.0, label: '7.0', description: '良好水平' },
  { value: 7.5, label: '7.5', description: '优秀水平' },
  { value: 8.0, label: '8.0', description: '专业水平' },
  { value: 8.5, label: '8.5', description: '接近母语' },
  { value: 9.0, label: '9.0', description: '专家水平' }
]

// 字数限制
const titleLimit = 100
const contentLimit = 500

// 计算标题的单词数
const titleWordCount = computed(() => {
  return formData.value.title
    ? formData.value.title.trim().split(/\s+/).filter(word => word.length > 0).length
    : 0
})

// 计算内容的单词数
const contentWordCount = computed(() => {
  return formData.value.content
    ? formData.value.content.trim().split(/\s+/).filter(word => word.length > 0).length
    : 0
})

// 计算剩余单词数
const titleRemaining = computed(() => titleLimit - titleWordCount.value)
const contentRemaining = computed(() => contentLimit - contentWordCount.value)

// 表单提交状态
const submitting = ref(false)

// 表单验证规则
const rules = {
  writingType: [{ required: true, message: '请选择写作类型', trigger: 'change' }],
  targetScore: [{ required: true, message: '请选择目标分数', trigger: 'change' }],
  title: [
    { required: true, message: '请输入题目', trigger: ['blur', 'change'] },
    {
      validator: (_rule: any, value: string, callback: Function) => {
        if (value) {
          const wordCount = value.trim().split(/\s+/).filter(word => word.length > 0).length
          if (wordCount > titleLimit) {
            callback(new Error(`题目不能超过${titleLimit}个单词`))
          } else {
            callback()
          }
        } else {
          callback()
        }
      },
      trigger: ['blur', 'change']
    }
  ],
  content: [
    { required: true, message: '请输入作文内容', trigger: ['blur', 'change'] },
    {
      validator: (_rule: any, value: string, callback: Function) => {
        if (value) {
          const wordCount = value.trim().split(/\s+/).filter(word => word.length > 0).length
          if (wordCount > contentLimit) {
            callback(new Error(`作文内容不能超过${contentLimit}个单词`))
          } else {
            callback()
          }
        } else {
          callback()
        }
      },
      trigger: ['blur', 'change']
    }
  ],
}

// 关闭对话框
const handleClose = () => {
  dialogVisible.value = false
}

// 批改进度对话框
const feedbackProgressVisible = ref(false)
const currentFeedbackId = ref<number | null>(null)
const currentProjectId = ref<number | null>(null)

// 提交表单
const handleSubmit = async () => {
  if (!formRef.value) return
  
  try {
    submitting.value = true
    console.log('【提交状态】submitting = true')
    
    // 表单验证
    try {
      await formRef.value.validate()
      console.log('【表单验证】通过')
      
      try {
        // 创建项目
        console.log('【创建项目】开始创建项目', formData.value)
        const projectData = await projectApi.create({
          title: formData.value.title,
          category: formData.value.writingType,
          chartImage: formData.value.chartImage,
          targetScore: formData.value.targetScore.toString(),
          prompt: formData.value.content, 
          examType: 'ielts' 
        })
        
        console.log('【创建项目成功】', projectData)
        
        ElMessage.success('创建项目成功')
        
        // 获取创建的项目ID
        const projectId = projectData.id ||
          null
          
        console.log(`【准备调用AI批改】项目ID: ${projectId}, 类型: ${typeof projectId}`)
        
        if (projectId) {
          // 默认是第一个版本
          const versionNumber = 1
          console.log(`【调用AI批改】项目ID: ${projectId}, 版本号: ${versionNumber}, 题目提示: ${formData.value.title}`)
          
          // 记录具体的API请求URL和参数，便于调试
          const configStore = useConfigStore()
          const activeModelName = configStore.config.model || 'doubao'
          console.log('【AI批改】即将发送请求到:', `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api'}/ai-feedback/projects/${projectId}/versions/${versionNumber}/generate/${activeModelName.toLowerCase()}`)
          
          const response = await projectApi.generateActiveFeedback(projectId, versionNumber, {
            prompt: formData.value.title, // 使用题目作为自定义提示
            useStepByStepStrategy: true, // 使用分步骤策略以优化长文本处理
            targetScore: formData.value.targetScore.toString(), // 添加目标分数
            generateExampleEssay: true // 确保每次都生成范文
          })
          
          console.log('【AI批改请求成功】已提交批改请求，等待服务端处理', response)
          
          // 显示批改进度对话框
          if (response && response.feedbackId) {
            currentFeedbackId.value = response.feedbackId
            currentProjectId.value = projectId
            feedbackProgressVisible.value = true
            
            // 立即发送一个日志
            console.log(`【开始批改进度监控】feedbackId=${response.feedbackId}, projectId=${projectId}, versionNumber=${versionNumber}`)
          }
          
          ElMessage.success('作文批改请求已提交，请稍候查看结果')
        } else {
          console.warn('【AI批改失败】无法获取有效的项目ID')
        }
      } catch (error) {
        console.error('【AI批改失败】提交批改请求时发生错误:', error)
        ElMessage.warning('作文创建成功，但批改请求提交失败，请稍后重试')
      }
      
      // 重置表单
      formRef.value.resetFields()
      chartImage.value = []
      console.log('【表单已重置】已清空表单数据和图片')
      
      // 关闭对话框
      handleClose()
    } catch (error) {
      console.error('【表单验证失败】', error)
    } finally {
      submitting.value = false
      console.log('【提交状态重置】submitting = false')
    }
  } catch (error) {
    console.error('【表单验证失败】', error)
  }
}

// 处理批改完成
const handleFeedbackCompleted = (data: any) => {
  console.log(`【批改完成】收到数据:`, data)
  
  // 仅在批改真正完成时触发刷新
  if (data && data.status === 'completed') {
    // 触发refresh事件，通知父组件刷新项目列表
    console.log('【触发刷新】通知父组件刷新项目列表')
    emit('refresh')
  } else {
    console.log('【批改进行中】暂不触发刷新')
  }
  
  // 处理不同的参数格式
  if (typeof data === 'object') {
    if (data.feedbackId) {
      currentFeedbackId.value = data.feedbackId
    }
    if (data.projectId) {
      currentProjectId.value = data.projectId
    }
  } else if (typeof data === 'number') {
    // 兼容旧版本
    currentFeedbackId.value = data
  }
  
  // 如果批改已完成，延迟半秒关闭进度对话框
  if (data && data.status === 'completed') {
    currentFeedbackId.value = null
    currentProjectId.value = null
    setTimeout(() => {
      feedbackProgressVisible.value = false
    }, 500)
  }
}

// 处理批改失败
const handleFeedbackFailed = () => {
  console.log('【批改失败】')
  // 不自动关闭对话框，让用户可以选择重试
}

// 获取当前分数的描述
const getScoreDescription = computed(() => {
  const score = scoreOptions.find(option => option.value === formData.value.targetScore)
  return score ? score.description : ''
})

// 清除图片上传（当切换到Writing2时）
watch(() => formData.value.writingType, (newVal) => {
  if (newVal === 'Writing2' && chartImage.value.length > 0) {
    chartImage.value = []
    formData.value.chartImage = undefined
  }
})

// 图片预览相关
const previewVisible = ref(false)
const previewImage = ref('')

// 处理图片预览
const handlePreview = () => {
  if (chartImage.value.length > 0 && chartImage.value[0].url) {
    previewImage.value = chartImage.value[0].url
    previewVisible.value = true
  }
}

// 创建上传组件的 key
const uploadKey = ref(Date.now())
</script>

<template>
  <el-dialog
    v-model="dialogVisible"
    :show-close="false"
    width="860px"
    :close-on-click-modal="false"
    :close-on-press-escape="!submitting"
    class="ielts-project-dialog custom-dialog"
    top="5vh"
    destroy-on-close
  >
    <template #header>
      <div class="custom-header">
        <div class="title-wrapper">
          <h2>创建雅思写作项目</h2>
        </div>
        <button class="close-btn" @click="handleClose">
          <el-icon><Close /></el-icon>
        </button>
      </div>
    </template>

    <div class="form-content">
      <el-form
        ref="formRef"
        :model="formData"
        :rules="rules"
        label-position="top"
        class="project-form"
      >
        <!-- 两列布局：左侧写作类型和目标分数，右侧图片上传 -->
        <div class="two-column-layout">
          <!-- 左侧列：写作类型和目标分数 -->
          <div class="left-column">
            <!-- 写作类型选择卡片 -->
            <el-form-item prop="writingType" class="writing-type-selector">
              <div class="writing-type-header">
                <div class="type-label">写作类型</div>
                <div class="writing-type-options">
                  <div 
                    class="type-option" 
                    :class="{ 'active': formData.writingType === 'Writing1' }"
                    @click="formData.writingType = 'Writing1'"
                  >
                    <div class="option-content">
                      <span class="task-label">Task 1</span>
                      <span class="task-desc">图表描述</span>
                    </div>
                    <div class="option-indicator">
                      <div class="check-circle">
                        <el-icon><Check /></el-icon>
                      </div>
                    </div>
                  </div>
                  
                  <div 
                    class="type-option" 
                    :class="{ 'active': formData.writingType === 'Writing2' }"
                    @click="formData.writingType = 'Writing2'"
                  >
                    <div class="option-content">
                      <span class="task-label">Task 2</span>
                      <span class="task-desc">议论文写作</span>
                    </div>
                    <div class="option-indicator">
                      <div class="check-circle">
                        <el-icon><Check /></el-icon>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </el-form-item>
            
            <!-- 目标分数 -->
            <el-form-item prop="targetScore" class="score-selector">
              <div class="score-header">
                <div class="type-label">目标分数</div>
                <div class="score-content">
                  <div class="slider-container">
                    <el-slider
                      v-model="formData.targetScore"
                      :min="6"
                      :max="9"
                      :step="0.5"
                      :marks="{
                        6: '6.0',
                        6.5: '6.5',
                        7: '7.0',
                        7.5: '7.5',
                        8: '8.0',
                        8.5: '8.5',
                        9: '9.0'
                      }"
                      :disabled="submitting"
                      show-stops
                    />
                  </div>
                  <div class="score-display">
                    <div class="score-value">{{ formData.targetScore.toFixed(1) }}</div>
                    <div class="score-description">{{ getScoreDescription }}</div>
                  </div>
                </div>
              </div>
            </el-form-item>
          </div>
          
          <!-- 右侧列：图表上传 -->
          <div class="right-column">
            <el-form-item class="upload-form-item">
              <div class="chart-upload-container">
                <!-- 未上传图片时显示上传区域 -->
                <el-upload
                  v-if="!chartImage.length"
                  :key="uploadKey"
                  class="chart-uploader"
                  action="#"
                  :auto-upload="true"
                  :show-file-list="false"
                  :on-success="handleUploadSuccess"
                  :before-upload="beforeUpload"
                  :on-remove="handleRemove"
                  :disabled="submitting || formData.writingType !== 'Writing1'"
                  :limit="1"
                  accept="image/*"
                  :http-request="({ file }: UploadRequestOptions) => handleUploadSuccess({}, { raw: file } as UploadFile)"
                  drag
                >
                  <div 
                    :class="[
                      'upload-placeholder', 
                      { 'disabled': formData.writingType !== 'Writing1' }
                    ]"
                  >
                    <el-icon class="upload-icon"><UploadFilled /></el-icon>
                    <div class="upload-text">
                      <span v-if="formData.writingType === 'Writing1'">点击或拖拽图表上传</span>
                      <span v-else>Task 2 不需要上传图表</span>
                      <span class="upload-hint" v-if="formData.writingType === 'Writing1'">支持 JPG, PNG 格式 (最大 2MB)</span>
                    </div>
                  </div>
                </el-upload>
                
                <!-- 已上传图片时显示预览 -->
                <div v-else class="image-preview">
                  <img :src="chartImage[0].url" class="preview-image" />
                  <div class="image-actions">
                    <el-button 
                      type="primary" 
                      circle 
                      @click.stop="handlePreview"
                      class="action-btn preview-btn"
                    >
                      <el-icon><Search /></el-icon>
                    </el-button>
                    <el-button 
                      type="danger" 
                      circle 
                      @click.stop="handleRemove"
                      class="action-btn delete-btn"
                    >
                      <el-icon><Delete /></el-icon>
                    </el-button>
                  </div>
                </div>
              </div>
            </el-form-item>
          </div>
        </div>
        
        <!-- 题目输入区域 -->
        <el-form-item label="题目" prop="title">
          <div class="input-with-counter fancy-input">
            <el-input
              v-model="formData.title"
              type="textarea"
              :rows="2"
              placeholder="请输入题目，例如：The graph below shows the proportion of the population aged 65 and over..."
              :disabled="submitting"
              resize="none"
              :show-word-limit="false"
            />
            <div class="word-counter" :class="{ 'warning': titleRemaining < 10 }">
              {{ titleWordCount }} / {{ titleLimit }}
            </div>
          </div>
        </el-form-item>

        <!-- 作文内容 -->
        <el-form-item label="作文内容" prop="content">
          <div class="input-with-counter fancy-input">
            <el-input
              v-model="formData.content"
              type="textarea"
              :rows="14"
              placeholder="请输入您的作文内容..."
              :disabled="submitting"
              resize="none"
              :show-word-limit="false"
            />
            <div class="word-counter" :class="{ 'warning': contentRemaining < 50 }">
              {{ contentWordCount }} / {{ contentLimit }}
            </div>
          </div>
        </el-form-item>
      </el-form>
    </div>
    
    <template #footer>
      <div class="dialog-footer">
        <el-button 
          @click="handleClose" 
          :disabled="submitting" 
          plain 
          class="cancel-button"
        >
          取消
        </el-button>
        <el-button 
          type="primary" 
          @click="handleSubmit" 
          :loading="submitting"
          class="submit-button"
        >
          {{ submitting ? '提交中' : '提交作文' }}
        </el-button>
      </div>
    </template>
  </el-dialog>

  <!-- 图片预览对话框 -->
  <el-dialog
    v-model="previewVisible"
    width="800px"
    :show-close="true"
    destroy-on-close
    class="preview-dialog"
  >
    <div class="preview-container">
      <img :src="previewImage" class="preview-dialog-image" />
    </div>
  </el-dialog>

  <!-- 批改进度对话框 -->
  <FeedbackProgress
    v-if="currentFeedbackId && currentProjectId"
    v-model:visible="feedbackProgressVisible"
    :feedback-id="currentFeedbackId"
    :project-id="currentProjectId"
    :version-number="1"
    :project-title="formData.title"
    @completed="handleFeedbackCompleted"
    @failed="handleFeedbackFailed"
  />
</template>

<style scoped>
@import './IELTSProjectDialog.css';
</style>