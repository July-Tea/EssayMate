<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useConfigStore } from '../stores/config'
import {
  Check,
  Setting
} from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import robot from '../assets/robot.svg'
import ModelSelector from '../components/setup/ModelSelector.vue'
import ApiKeyInput from '../components/setup/ApiKeyInput.vue'
import ModelNameInput from '../components/setup/ModelNameInput.vue'
import SetupComplete from '../components/setup/SetupComplete.vue'

const router = useRouter()
const configStore = useConfigStore()
const activeStep = ref(0)
const modelType = ref('Doubao')
const apiKey = ref('')
const modelName = ref('') // 移除默认值
const loading = ref(false)
const hasError = ref(false)

// 计算属性，判断是否为豆包模型
const isDoubaoModel = computed(() => modelType.value === 'Doubao')

// 计算属性，判断是否为通义千问模型
const isTongyiModel = computed(() => modelType.value === 'Tongyi')

// 计算属性，判断是否为Kimi模型
const isKimiModel = computed(() => modelType.value === 'Kimi')

// 计算属性，判断是否需要显示模型名称输入框
const showModelNameInput = computed(() => isDoubaoModel.value || isTongyiModel.value || isKimiModel.value)

onMounted(async () => {
  try {
    // 强制从后端重新加载配置，不使用任何缓存
    await configStore.loadConfig()
    
    // 只有当后端返回有效配置时，才更新本地状态
    if (configStore.config.model && configStore.config.apiKey) {
      modelType.value = configStore.config.model
      apiKey.value = configStore.config.apiKey
      modelName.value = configStore.config.model_name || ''
    } else {
      // 如果后端没有配置，确保本地状态为默认值
      modelType.value = 'Doubao'
      apiKey.value = ''
      modelName.value = ''
    }
  } catch (error) {
    console.error('加载配置失败:', error)
    // 出错时使用默认值
    modelType.value = 'Doubao'
    apiKey.value = ''
    modelName.value = ''
  }
})

const handleNext = () => {
  if (activeStep.value < 2) {
    activeStep.value++
  } else if (configStore.isConfigured) {
    router.push('/home')
  }
}

const handleBack = () => {
  if (activeStep.value > 0) {
    activeStep.value--
  }
}

const handleKeyDown = (event: KeyboardEvent) => {
  if (event.key === 'Enter' && !configStore.isLoading && !loading.value) {
    if (activeStep.value === 1) {
      testApiKey()
    } else {
      handleNext()
    }
  }
}

const testApiKey = async () => {
  if (configStore.isLoading || hasError.value || loading.value) return;
  
  try {
    loading.value = true;
    
    // 指定类型为AIConfig
    const config: any = {
      model: modelType.value,
      apiKey: apiKey.value
    };
    
    // 如果是需要模型名称的模型，添加model_name字段
    if (showModelNameInput.value) {
      // 检查模型名称是否为空
      if (!modelName.value || modelName.value.trim() === '') {
        const modelDisplayName = isDoubaoModel.value ? '豆包' : isTongyiModel.value ? '通义千问' : 'Kimi';
        ElMessage.error(`请输入${modelDisplayName}模型名称`);
        hasError.value = true;
        setTimeout(() => {
          hasError.value = false;
        }, 3000);
        return;
      }
      
      config.model_name = modelName.value.trim();
      console.log(`${modelType.value}模型名称:`, config.model_name);
      // 不再设置modelConfigs字段，由后端处理
    }
    
    // 使用抽象后的方法进行验证和配置
    const success = await configStore.setAIConfig(config);
    
    if (success) {
      hasError.value = false;
      ElMessage.success('配置成功');
      await configStore.loadConfig();
      activeStep.value++;
    }
  } catch (error) {
    hasError.value = true;
    ElMessage.error(configStore.error?.message || 'API验证失败，请检查密钥是否正确');
    setTimeout(() => {
      hasError.value = false;
    }, 3000);  // 3秒后重置错误状态
  } finally {
    loading.value = false;
  }
}

// 监听 apiKey 的变化，当用户修改输入时清除错误状态
watch([apiKey, modelName], () => {
  hasError.value = false
  configStore.clearError()
})
</script>

<template>
  <div class="init-config-container">
    <el-steps :active="activeStep" finish-status="success" class="steps" align-center>
      <el-step title="选择模型">
        <template #icon>
          <img :src="robot" alt="Robot Icon" style="width: 24px; height: 24px;" />
        </template>
      </el-step>
      <el-step title="配置API" :icon="Setting" />
      <el-step title="完成" :icon="Check" />
    </el-steps>

    <div class="step-content">
      <div :class="['step-page', { active: activeStep === 0 }]">
        <ModelSelector v-model:modelType="modelType" />
      </div>

      <div :class="['step-page', { active: activeStep === 1 }]">
        <ApiKeyInput 
          v-model:apiKey="apiKey" 
          :hasError="hasError"
          @keydown="handleKeyDown"
        />
        <!-- 显示模型名称输入框 -->
        <ModelNameInput
          v-if="showModelNameInput"
          v-model:modelName="modelName"
          :model-type="modelType"
        />
      </div>

      <div :class="['step-page', { active: activeStep === 2 }]">
        <SetupComplete />
      </div>

      <div class="step-actions">
        <el-button 
          v-if="activeStep !== 0" 
          @click="handleBack" 
          :disabled="activeStep === 0 || loading || configStore.isLoading"
        >
          上一步
        </el-button>
        <el-button
          type="primary"
          @click="activeStep === 1 ? testApiKey() : handleNext()"
          :loading="loading || (activeStep === 1 && configStore.isLoading)"
          :disabled="loading || configStore.isLoading"
        >
          {{ activeStep === 2 ? '开始使用' : '下一步' }}
        </el-button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.init-config-container {
  max-width: 600px;
  width: 100%;
  margin: 0 auto;
  padding: 20px;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  overflow: visible;
}

.steps {
  padding-top: 40px;
  margin-bottom: 40px;
  flex-shrink: 0;
  position: sticky;
  top: 0;
  background-color: var(--el-bg-color);
  z-index: 10;
  padding-bottom: 20px;
  width: 100%;
  left: 0;
  margin-left: -20px;
  padding-left: 20px;
  padding-right: 20px;
}

.step-content {
  text-align: center;
  flex: 1;
  display: flex;
  flex-direction: column;
  position: relative;
  min-height: 400px;
  width: 100%;
}

.step-page {
  position: absolute;
  width: 100%;
  left: 0;
  opacity: 0;
  transform: translateX(30px);
  transition: all 0.4s ease;
  pointer-events: none;
  padding: 0;
  right: 0;
  margin: 0 auto;
}

.step-page.active {
  position: relative;
  opacity: 1;
  transform: translateX(0);
  pointer-events: all;
}

.step-actions {
  margin-top: auto;
  padding-top: 16px;
  padding-bottom: 16px;
  position: sticky;
  bottom: 0;
  background-color: var(--el-bg-color);
  z-index: 10;
  width: 100%;
  left: 0;
  margin-left: -20px;
  padding-left: 20px;
  padding-right: 20px;
}
</style>