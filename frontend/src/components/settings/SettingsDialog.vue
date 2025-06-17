<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import {
  Setting,
  Connection,
  InfoFilled,
  Close,
  Edit,
  Tools,
  Loading
} from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { useConfigStore } from '../../stores/config'
import api from '../../utils/api'

interface AIModel {
  key: string
  name: string
  displayName: string
  icon: string
  description: string
  status: string
}

const props = defineProps<{
  visible: boolean
  aiModels: AIModel[]
}>()

const emit = defineEmits(['update:visible'])

const configStore = useConfigStore()
const activeSettingMenu = ref('ai')
const showApiKeyDialog = ref(false)
const selectedModel = ref<AIModel | null>(null)
const apiKeyInput = ref('')
const isConfiguring = ref(false)
const modelName = ref('')
const hasApiKeyError = ref(false)

// 通用设置相关
const maxConcurrentTasks = ref(1)
const isSavingGeneralSettings = ref(false)
const saveTimeout = ref<NodeJS.Timeout | null>(null)

const settingsMenu = [
  {
    key: 'ai',
    label: 'AI配置',
    icon: Setting
  },
  {
    key: 'general',
    label: '通用设置',
    icon: Tools
  },
  {
    key: 'about',
    label: '关于',
    icon: InfoFilled
  },
  {
    key: 'future',
    label: '更多功能',
    icon: Connection,
    disabled: true,
    tooltip: '功能开发中...'
  }
]

// 是否为当前活动模型
const isActiveModel = (model: AIModel | null): boolean => {
  if (!model) return false;
  return configStore.isActiveModel(model.name);
}

// 判断模型状态
const getModelStatus = (model: AIModel | null): string => {
  // 如果模型为空，则返回未配置状态
  if (!model) return 'unconfigured';
  
  // 使用 configStore 方法检查状态
  return configStore.getModelStatus(model.name);
}

// 判断是否为豆包模型
const isDoubaoModel = computed(() => {
  return selectedModel.value?.name.toLowerCase() === 'doubao';
});

// 判断是否为通义千问模型
const isTongyiModel = computed(() => {
  return selectedModel.value?.name.toLowerCase() === 'tongyi';
});

// 判断是否为Kimi模型
const isKimiModel = computed(() => {
  return selectedModel.value?.name.toLowerCase() === 'kimi';
});

// 判断是否需要显示模型名称输入框
const showModelNameInput = computed(() => {
  return isDoubaoModel.value || isTongyiModel.value || isKimiModel.value;
});

// 加载通用设置
const loadGeneralSettings = async () => {
  try {
    // 从后端加载通用设置
    const response = await api.get('/api/config/general');
    if (response.data.success && response.data.data) {
      maxConcurrentTasks.value = response.data.data.maxConcurrentTasks || 1;
    }
  } catch (error) {
    console.error('加载通用设置失败:', error);
    // 使用默认值
    maxConcurrentTasks.value = 1;
  }
}

// 保存通用设置（带防抖）
const saveGeneralSettings = () => {
  // 如果已经在保存中，直接返回
  if (isSavingGeneralSettings.value) return;

  // 清除之前的定时器
  if (saveTimeout.value) {
    clearTimeout(saveTimeout.value);
  }

  // 设置新的定时器，500ms后执行保存
  saveTimeout.value = setTimeout(async () => {
    try {
      isSavingGeneralSettings.value = true;

      const response = await api.post('/api/config/general', {
        maxConcurrentTasks: maxConcurrentTasks.value
      });

      if (response.data.success) {
        ElMessage.success('通用设置保存成功');
      } else {
        throw new Error(response.data.message || '保存失败');
      }
    } catch (error) {
      console.error('保存通用设置失败:', error);
      ElMessage.error('保存通用设置失败');
    } finally {
      isSavingGeneralSettings.value = false;
    }
  }, 500);
}

// 加载配置
onMounted(async () => {
  try {
    // 先加载所有配置，再加载活动配置
    await configStore.loadConfigs();
    await configStore.loadConfig();

    // 加载通用设置
    await loadGeneralSettings();

    // 简化调试输出
    console.log('加载配置完成，活动配置:', configStore.activeConfig);
    console.log('所有配置:', configStore.allConfigs);

    // 遍历所有模型，检查是否有活动模型
    props.aiModels.forEach(model => {
      if (configStore.isActiveModel(model.name)) {
        console.log(`初始化检测: ${model.name} 是活动模型`);
      }
    });
  } catch (error) {
    console.error('加载配置失败:', error);
  }
})

// 监听visible变化
watch(() => props.visible, async (newVal) => {
  if (newVal) {
    try {
      // 先加载所有配置，再加载活动配置
      await configStore.loadConfigs();
      await configStore.loadConfig();

      // 加载通用设置
      await loadGeneralSettings();

      // 调试输出活动模型信息
      console.log('对话框显示，当前活动配置:', configStore.activeConfig);
      console.log('所有配置:', configStore.allConfigs);

      // 遍历所有模型，检查是否有活动模型
      props.aiModels.forEach(model => {
        if (configStore.isActiveModel(model.name)) {
          console.log(`对话框打开检测: ${model.name} 是活动模型`);
        }
      });
    } catch (error) {
      console.error('加载配置失败:', error);
    }
  }
})

// 监听输入变化，清除错误状态
watch([apiKeyInput, modelName], () => {
  hasApiKeyError.value = false;
  configStore.clearError();
});

const handleClose = () => {
  // 在关闭对话框时记录日志
  console.log('关闭设置对话框，最终活动配置:', configStore.activeConfig);
  
  // 清理选择的模型
  selectedModel.value = null;
  apiKeyInput.value = '';
  modelName.value = '';
  hasApiKeyError.value = false;
  
  emit('update:visible', false)
}

const handleConfigureModel = async (model: AIModel) => {
  selectedModel.value = model
  console.log('配置模型:', model.name);
  
  // 清空输入框，避免显示旧数据
  apiKeyInput.value = ''
  modelName.value = ''
  hasApiKeyError.value = false
  
  try {
    // 确保加载最新的所有配置数据
    await configStore.loadConfigs();
    console.log('所有配置:', configStore.allConfigs);
    console.log('活动配置:', configStore.config);
    
    // 从配置存储中获取该模型的配置
    const modelConfig = configStore.getConfigByModel(model.name);
    console.log('获取到模型配置:', modelConfig);
    
    // 诊断信息
    console.log('当前模型是否为活动模型:', configStore.isActiveModel(model.name));
    console.log('当前模型状态:', configStore.getModelStatus(model.name));
    console.log('模型名称比较:', {
      modelName: model.name,
      modelNameLower: model.name.toLowerCase(),
      configModel: configStore.config.model,
      configModelLower: configStore.config.model.toLowerCase(),
      isMatch: model.name.toLowerCase() === configStore.config.model.toLowerCase()
    });
    
    if (modelConfig) {
      // 如果有配置，则填充表单
      apiKeyInput.value = modelConfig.apiKey || '';
      
      // 处理需要模型名称的模型的特殊字段
      if (showModelNameInput.value) {
        // 尝试直接获取model_name
        if (modelConfig.model_name) {
          modelName.value = modelConfig.model_name;
        } 
        // 尝试从modelConfigs获取
        else if (modelConfig.modelConfigs) {
          try {
            // 处理各种可能的格式
            let modelConfigsObj = modelConfig.modelConfigs;
            
            // 如果是字符串，尝试解析JSON
            if (typeof modelConfigsObj === 'string') {
              try {
                modelConfigsObj = JSON.parse(modelConfigsObj);
              } catch (e) {
                console.error('modelConfigs不是有效的JSON字符串:', e);
              }
            }
            
            // 处理可能的嵌套情况
            if (modelConfigsObj && modelConfigsObj.model_name) {
              modelName.value = modelConfigsObj.model_name;
            } 
            // 处理可能的嵌套modelConfigs字段
            else if (modelConfigsObj && modelConfigsObj.modelConfigs) {
              const nestedConfig = typeof modelConfigsObj.modelConfigs === 'string' 
                ? JSON.parse(modelConfigsObj.modelConfigs) 
                : modelConfigsObj.modelConfigs;
              
              if (nestedConfig && nestedConfig.model_name) {
                modelName.value = nestedConfig.model_name;
              }
            }
          } catch (e) {
            console.error('解析modelConfigs失败:', e);
          }
        }
      }
      
      console.log('填充表单:', { apiKey: apiKeyInput.value, modelName: modelName.value });
    } else {
      // 如果为活动模型但找不到配置，则尝试使用活动配置
      if (configStore.isActiveModel(model.name)) {
        console.log('使用活动配置填充表单');
        apiKeyInput.value = configStore.config.apiKey || '';
        if (showModelNameInput.value && configStore.config.model_name) {
          modelName.value = configStore.config.model_name;
        }
      }
    }
  } catch (error) {
    console.error('获取模型配置失败:', error);
  }
  
  showApiKeyDialog.value = true
}

const handleApiKeySubmit = async () => {
  if (!selectedModel.value || !apiKeyInput.value) {
    ElMessage.warning('请输入API密钥')
    hasApiKeyError.value = true;
    return
  }
  
  // 如果需要模型名称但未输入，提示错误
  if (showModelNameInput.value && (!modelName.value || modelName.value.trim() === '')) {
    const modelDisplayName = isDoubaoModel.value ? '豆包' : isTongyiModel.value ? '通义千问' : 'Kimi';
    ElMessage.warning(`请输入${modelDisplayName}模型名称`);
    hasApiKeyError.value = true;
    return;
  }
  
  isConfiguring.value = true;
  try {
    // 创建配置对象
    const configData: any = {
      model: selectedModel.value.name,
      apiKey: apiKeyInput.value
    };
    
    // 如果需要模型名称，添加model_name字段
    if (showModelNameInput.value && modelName.value) {
      configData.model_name = modelName.value.trim();
      // 不再设置modelConfigs字段，由后端处理
    }
    
    // 验证API密钥并保存配置
    console.log('提交配置:', configData);
    const success = await configStore.setAIConfig(configData);
    
    if (success) {
      hasApiKeyError.value = false;
      showApiKeyDialog.value = false;
      
      // 重新加载配置，确保状态更新
      await configStore.loadConfig();
      
      // 使用辅助方法检查模型状态
      const isCurrentlyActive = configStore.isActiveModel(selectedModel.value.name);
      
      if (isCurrentlyActive) {
        ElMessage.success(`已更新 ${selectedModel.value.displayName} 配置`);
      } else {
        ElMessage.success(`已切换至 ${selectedModel.value.displayName}`);
      }
    }
  } catch (error) {
    hasApiKeyError.value = true;
    ElMessage.error(configStore.error?.message || 'API验证失败，请检查密钥是否正确');
    console.error('验证/保存配置失败:', error);
  } finally {
    isConfiguring.value = false;
  }
}

// 获取对话框标题
const getDialogTitle = (): string => {
  if (!selectedModel.value) return '配置模型';
  
  if (isActiveModel(selectedModel.value)) {
    return `修改 ${selectedModel.value.displayName} 配置`;
  } else if (getModelStatus(selectedModel.value) === 'configured') {
    return `切换至 ${selectedModel.value.displayName}`;
  } else {
    return `配置 ${selectedModel.value.displayName}`;
  }
}

// 获取按钮文本
const getButtonText = (model: AIModel): string => {
  if (isActiveModel(model)) {
    return '修改配置';
  } else if (getModelStatus(model) === 'configured') {
    return '切换使用';
  } else {
    return '配置使用';
  }
}

// 获取输入框提示文本
const getPlaceholderText = (): string => {
  if (!selectedModel.value) return '请输入API密钥';
  
  if (getModelStatus(selectedModel.value) === 'configured') {
    return '当前配置已加载，可直接修改';
  } else {
    return '请输入API密钥';
  }
}
</script>

<template>
  <el-dialog
    :model-value="visible"
    :show-close="false"
    width="800px"
    :close-on-click-modal="false"
    class="settings-dialog custom-dialog"
    @update:model-value="emit('update:visible', $event)"
  >
    <template #header>
      <div class="custom-header">
        <div class="title-wrapper">
          <h2>系统设置</h2>
        </div>
        <button class="close-btn" @click="handleClose">
          <el-icon><Close /></el-icon>
        </button>
      </div>
    </template>
    
    <div class="settings-layout">
      <!-- 左侧菜单 -->
      <div class="settings-menu">
        <el-menu
          :default-active="activeSettingMenu"
          class="settings-menu-list"
        >
          <el-menu-item
            v-for="item in settingsMenu"
            :key="item.key"
            :index="item.key"
            :disabled="item.disabled"
            @click="activeSettingMenu = item.key"
          >
            <el-tooltip
              v-if="item.tooltip"
              :content="item.tooltip"
              placement="right"
            >
              <div class="menu-item-content">
                <el-icon><component :is="item.icon" /></el-icon>
                <span>{{ item.label }}</span>
              </div>
            </el-tooltip>
            <template v-else>
              <el-icon><component :is="item.icon" /></el-icon>
              <span>{{ item.label }}</span>
            </template>
          </el-menu-item>
        </el-menu>
      </div>

      <!-- 右侧内容区 -->
      <div class="settings-content">
        <!-- AI配置面板 -->
        <div v-if="activeSettingMenu === 'ai'" class="ai-config-panel">
          <div class="section-header">
            <h3>AI模型配置</h3>
            <p class="section-description">
              选择并配置您想要使用的AI模型
            </p>
          </div>

          <div class="models-list">
            <div
              v-for="model in aiModels"
              :key="model.key"
              class="model-row"
              :class="{ configured: isActiveModel(model) }"
            >
              <div class="model-info">
                <div class="model-icon">
                  <img :src="model.icon" :alt="model.name" />
                </div>
                <div class="model-details">
                  <h4>{{ model.displayName }}</h4>
                  <p class="model-description">{{ model.description }}</p>
                </div>
              </div>
              <div class="model-actions">
                <el-button 
                  type="primary" 
                  @click="handleConfigureModel(model)"
                  :icon="Edit"
                >
                  {{ getButtonText(model) }}
                </el-button>
              </div>
            </div>
            
            <div class="models-coming-soon">
              <el-icon><Connection /></el-icon>
              <span>更多模型正在接入中...</span>
            </div>
          </div>
        </div>

        <!-- 通用设置面板 -->
        <div v-else-if="activeSettingMenu === 'general'" class="general-settings-panel">
          <div class="section-header">
            <h3>通用设置</h3>
          </div>

          <div class="simple-setting-item">
            <span class="setting-title">最大并发任务数</span>
            <el-input-number
              v-model="maxConcurrentTasks"
              :min="1"
              :max="20"
              :step="1"
              size="default"
              controls-position="right"
              @change="saveGeneralSettings"
            />
          </div>
        </div>

        <!-- 更多功能面板 -->
        <div v-else-if="activeSettingMenu === 'future'" class="future-panel">
          <el-empty description="更多功能开发中...">
            <template #image>
              <el-icon :size="60"><Connection /></el-icon>
            </template>
          </el-empty>
        </div>

        <!-- 关于面板 -->
        <div v-else-if="activeSettingMenu === 'about'" class="about-panel">
          <div class="about-header">
            <img src="./../../assets/icon.svg" alt="Logo" class="about-logo"/>
            <div class="about-title">
              <h2>EssayMate</h2>
              <span class="version">Version 0.1.1</span>
            </div>
          </div>

          <div class="about-content">
            <div class="about-section">
              <h3>关于 EssayMate</h3>
              <p>EssayMate 是一款专注于提升写作技能的智能助手，它提供了多个 AI 模型可供选择，为您提供专业的写作修改和润色。无论是准备雅思，还是托福、GRE等考试，EssayMate 都能成为您的得力助手。</p>
            </div>

            <div class="about-section">
              <h3>特色功能</h3>
              <div class="feature-grid">
                <div class="feature-item">
                  <div class="feature-info">
                    <div class="feature-icon">🎯</div>
                    <div class="feature-details">
                      <h4>智能修改</h4>
                      <p>利用 AI 模型，提供专业的写作建议和优化方案</p>
                    </div>
                  </div>
                </div>
                <div class="feature-item">
                  <div class="feature-info">
                    <div class="feature-icon">🔍</div>
                    <div class="feature-details">
                      <h4>深度分析</h4>
                      <p>对文章结构、语法用词进行全方位分析</p>
                    </div>
                  </div>
                </div>
                <div class="feature-item">
                  <div class="feature-info">
                    <div class="feature-icon">⚡️</div>
                    <div class="feature-details">
                      <h4>实时反馈</h4>
                      <p>快速获取写作建议，实时改进文章质量</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div class="about-section">
              <h3>支持模型概览</h3>
              <div class="tech-support">
                <div 
                  v-for="model in aiModels" 
                  :key="model.key"
                  class="tech-item"
                >
                  <img :src="model.icon" :alt="model.displayName" />
                  <span>{{ model.displayName }}</span>
                </div>
              </div>
            </div>

            <div class="about-footer">
              <div class="license-info">
                <p>本项目采用 <a href="https://creativecommons.org/licenses/by-nc/4.0/" target="_blank" rel="noopener noreferrer">CC BY-NC 4.0</a> 许可证。</p>
                <p>欢迎访问本项目的 <a href="https://github.com/July-Tea/EssayMate" target="_blank" rel="noopener noreferrer">GitHub 仓库</a>，期待您的 Star ⭐️ 和贡献！</p>
                <p>如有任何问题或建议，欢迎提交 Issue 或 Pull Request。</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- API密钥对话框 -->
    <el-dialog
      :model-value="showApiKeyDialog"
      :title="getDialogTitle()"
      width="500px"
      append-to-body
      :close-on-click-modal="false"
      :close-on-press-escape="!isConfiguring"
      :show-close="!isConfiguring"
      @update:model-value="showApiKeyDialog = $event"
    >
      <div class="api-key-form">
        <el-form label-position="top">
          <el-form-item :label="selectedModel?.displayName + ' API密钥'">
            <el-input
              v-model="apiKeyInput"
              type="password"
              :placeholder="getPlaceholderText()"
              show-password
              :disabled="isConfiguring"
              :class="{ 'is-error': hasApiKeyError }"
            />
          </el-form-item>
          
          <!-- 需要模型名称的模型的输入框 -->
          <el-form-item v-if="showModelNameInput" label="模型名称">
            <el-input
              v-model="modelName"
              :placeholder="isDoubaoModel 
                ? '请输入火山方舟API调用示例中的model字段值，如：doubao-1-5-pro-32k-250115' 
                : isTongyiModel
                  ? '请输入阿里云API调用示例中的model字段值，如：qwen-plus'
                  : '请输入Moonshot AI的API调用示例中的model字段值，如：moonshot-v1-8k'"
              :disabled="isConfiguring"
              :class="{ 'is-error': hasApiKeyError && showModelNameInput }"
            />
            <p class="help-text" style="text-align: left; margin-top: 4px; font-size: 12px; color: rgba(0, 0, 0, 0.45);">
              {{ isDoubaoModel 
                ? '请从火山方舟平台的API调用示例中获取model字段值，格式一般为：doubao-1-5-pro-32k-250115'
                : isTongyiModel
                  ? '请从阿里云的API调用示例中获取model字段值，例如：qwen-plus、qwen-max等'
                  : '请从Moonshot AI的API调用示例中获取model字段值，例如：moonshot-v1-8k、moonshot-v1-32k等' }}
            </p>
          </el-form-item>
        </el-form>
      </div>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="showApiKeyDialog = false" :disabled="isConfiguring">取消</el-button>
          <el-button
            type="primary"
            @click="handleApiKeySubmit"
            :loading="isConfiguring"
            :disabled="!apiKeyInput || (showModelNameInput && !modelName)"
          >
            {{ isConfiguring ? '验证中...' : '确认' }}
          </el-button>
        </span>
      </template>
    </el-dialog>
  </el-dialog>
</template>

<style scoped>
@import './SettingsDialog.css';

/* 添加错误状态样式 */
:deep(.is-error .el-input__wrapper) {
  box-shadow: 0 0 0 1px var(--el-color-danger) !important;
}

:deep(.is-error .el-input__wrapper:hover) {
  box-shadow: 0 0 0 1px var(--el-color-danger) !important;
}
</style>