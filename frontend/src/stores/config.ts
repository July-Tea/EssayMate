import { defineStore } from 'pinia';
import api from '../utils/api';
import { ElMessage } from 'element-plus';

interface AIConfig {
  id?: number;
  model: string;
  apiKey: string;
  model_name?: string;
  modelConfigs?: any;
  is_active?: boolean;
  updated_at?: string;
  created_at?: string;
}

// 新增：模型状态类型
type ModelStatus = 'configured' | 'active' | 'unconfigured';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

interface ValidateResponse {
  isValid: boolean;
  message?: string;
  code?: string;
}

type ConfigStatus = 'initial' | 'validating' | 'saving' | 'ready' | 'error';

interface ConfigState {
  status: ConfigStatus;
  config: AIConfig;
  error?: {
    code: string;
    message: string;
  };
  lastUpdated?: string;
  isProcessing: boolean;
  allConfigs: AIConfig[];
}

export const useConfigStore = defineStore('config', {
  state: (): ConfigState => ({
    status: 'initial',
    config: {
      model: '',
      apiKey: ''
    },
    error: undefined,
    lastUpdated: undefined,
    isProcessing: false,
    allConfigs: []
  }),

  getters: {
    isConfigured: (state) => {
      // 只要状态是 ready 且有模型配置就认为已配置
      return state.status === 'ready' && !!state.config.model;
    },
    hasError: (state) => state.status === 'error',
    isLoading: (state) => state.status === 'validating' || state.status === 'saving',
    // 获取活动配置
    activeConfig: (state) => {
      // 简化查询，直接查找is_active值为1或true的配置
      const active = state.allConfigs.find(config => {
        // 处理不同类型的is_active值
        if (config.is_active === undefined || config.is_active === null) return false;
        
        if (typeof config.is_active === 'boolean') return config.is_active === true;
        if (typeof config.is_active === 'number') return config.is_active === 1;
        if (typeof config.is_active === 'string') {
          const activeValue = config.is_active as string;
          return activeValue === '1' || activeValue.toLowerCase() === 'true';
        }
        
        // 如果所有类型判断都失败，则直接转换为布尔值
        return Boolean(config.is_active);
      });
      
      if (active) {
        console.log('找到活动配置:', active.model, 'is_active:', active.is_active, '类型:', typeof active.is_active);
      } else {
        console.log('未找到活动配置，所有配置:', 
          state.allConfigs.map(c => ({ 
            model: c.model, 
            is_active: c.is_active, 
            type: typeof c.is_active 
          }))
        );
      }
      
      return active || null;
    }
  },

  actions: {
    setError(code: string, message: string) {
      // 如果已经在处理中或已经是错误状态，不重复设置
      if (this.isProcessing || this.status === 'error') return;
      
      this.isProcessing = true;
      this.status = 'error';
      this.error = { code, message };
      ElMessage.error(message);
      this.isProcessing = false;
    },

    clearError() {
      if (this.isProcessing) return;
      
      this.isProcessing = true;
      this.error = undefined;
      if (this.status === 'error') {
        this.status = 'initial';
      }
      this.isProcessing = false;
    },

    // 加载所有配置
    async loadConfigs() {
      if (this.isProcessing) return;
      
      try {
        this.isProcessing = true;
        
        // 添加时间戳参数，确保不使用浏览器缓存
        const timestamp = new Date().getTime();
        const response = await api.get<ApiResponse<AIConfig[]>>(`/api/config?t=${timestamp}`);
        
        if (response.data.success && response.data.data) {
          this.allConfigs = response.data.data;
          
          // 查找活动配置
          const activeConfig = this.allConfigs.find(config => config.is_active);
          
          if (activeConfig) {
            this.config = activeConfig;
            this.status = 'ready';
          } else if (this.allConfigs.length > 0) {
            // 如果没有活动配置但有配置，设置第一个为活动
            this.config = this.allConfigs[0];
            this.status = 'ready';
          } else {
            // 没有任何配置
            this.status = 'initial';
            this.config = { model: '', apiKey: '' };
          }
          
          this.lastUpdated = new Date().toISOString();
        } else {
          const errorMessage = response.data.error?.message || '加载配置失败';
          console.error('配置加载失败:', errorMessage);
          
          // 如果已经是初始状态，不设为错误状态，也不显示错误消息
          if (this.status !== 'initial') {
            this.status = 'error';
            this.error = { 
              code: response.data.error?.code || 'UNKNOWN_ERROR', 
              message: errorMessage 
            };
            ElMessage.error(errorMessage);
          } else {
            // 首次加载失败时保持初始状态
            this.status = 'initial';
            this.config = { model: '', apiKey: '' };
            this.allConfigs = [];
          }
        }
      } catch (error: any) {
        console.error('加载配置失败:', error);
        
        // 如果已经是初始状态，不设为错误状态，也不显示错误消息
        if (this.status !== 'initial') {
          const errorMessage = error.response?.data?.error?.message || error.message || '加载配置失败';
          this.status = 'error';
          this.error = { 
            code: error.response?.data?.error?.code || 'LOAD_ERROR', 
            message: errorMessage 
          };
          ElMessage.error(errorMessage);
        } else {
          // 首次加载失败时保持初始状态
          this.status = 'initial';
          this.config = { model: '', apiKey: '' };
          this.allConfigs = [];
        }
      } finally {
        this.isProcessing = false;
      }
    },

    // 加载活动配置
    async loadConfig() {
      if (this.isProcessing) return;
      
      try {
        this.isProcessing = true;
        
        // 添加时间戳参数，确保不使用浏览器缓存
        const timestamp = new Date().getTime();
        const response = await api.get<ApiResponse<AIConfig>>(`/api/config/active?t=${timestamp}`);
        
        if (response.data.success && response.data.data) {
          const config = response.data.data;
          // 只有当配置有效时才设置为ready状态
          if (config.model && config.apiKey) {
            this.config = config;
            this.status = 'ready';
            this.lastUpdated = new Date().toISOString();
            
            // 触发加载所有配置
            await this.loadConfigs();
          } else {
            this.status = 'initial';
            this.config = { model: '', apiKey: '' };
          }
        } else {
          const errorMessage = response.data.error?.message || '加载配置失败';
          console.error('配置加载失败:', errorMessage);
          
          // 如果已经是初始状态，不设为错误状态，也不显示错误消息
          if (this.status !== 'initial') {
            this.status = 'error';
            this.error = { 
              code: response.data.error?.code || 'UNKNOWN_ERROR', 
              message: errorMessage 
            };
            ElMessage.error(errorMessage);
          } else {
            // 首次加载失败时保持初始状态
            this.status = 'initial';
            this.config = { model: '', apiKey: '' };
          }
        }
      } catch (error: any) {
        console.error('加载配置失败:', error);
        
        // 如果已经是初始状态，不设为错误状态，也不显示错误消息
        if (this.status !== 'initial') {
          const errorMessage = error.response?.data?.error?.message || error.message || '加载配置失败';
          this.status = 'error';
          this.error = { 
            code: error.response?.data?.error?.code || 'LOAD_ERROR', 
            message: errorMessage 
          };
          ElMessage.error(errorMessage);
        } else {
          // 首次加载失败时保持初始状态
          this.status = 'initial';
          this.config = { model: '', apiKey: '' };
        }
      } finally {
        this.isProcessing = false;
      }
    },

    // 新增：检查模型配置状态
    getModelStatus(modelName: string): ModelStatus {
      // 如果模型是当前活动模型
      if (this.config.model.toLowerCase() === modelName.toLowerCase() && this.config.is_active) {
        return 'active';
      }
      
      // 检查是否有该模型的配置
      const modelConfig = this.allConfigs.find(config => 
        config.model.toLowerCase() === modelName.toLowerCase()
      );
      
      if (modelConfig) {
        return 'configured';
      }
      
      return 'unconfigured';
    },

    // 新增：获取指定模型的配置
    getConfigByModel(modelName: string): AIConfig | null {
      // 首先尝试在所有配置中查找匹配的模型
      const config = this.allConfigs.find(config => 
        config.model.toLowerCase() === modelName.toLowerCase()
      );
      
      // 如果在所有配置中找到，则返回
      if (config) {
        return config;
      }
      
      // 如果没有找到，但是模型名称与当前活动模型匹配，则返回活动配置
      if (this.config.model.toLowerCase() === modelName.toLowerCase()) {
        console.log('在 allConfigs 中未找到模型，但与活动配置匹配，返回活动配置');
        return this.config;
      }
      
      // 否则返回 null
      console.log(`找不到模型 ${modelName} 的配置`);
      return null;
    },

    // 新增：检查是否有任何已配置的模型
    hasAnyConfiguredModel(): boolean {
      return this.allConfigs.length > 0;
    },

    // 新增：检查指定模型是否为当前活动模型
    isActiveModel(modelName: string): boolean {
      return this.config.model.toLowerCase() === modelName.toLowerCase() && Boolean(this.config.is_active);
    },

    // 保存或更新配置
    async setAIConfig(config: AIConfig): Promise<boolean> {
      if (this.isProcessing || this.isLoading) return false;
      
      try {
        this.isProcessing = true;
        this.clearError();
        this.status = 'validating';
        
        // 添加时间戳参数，确保不使用浏览器缓存
        const timestamp = new Date().getTime();
        const validateResponse = await api.post<ApiResponse<ValidateResponse>>(`/api/auth/validate?t=${timestamp}`, config);
        
        if (!validateResponse.data.success || !validateResponse.data.data?.isValid) {
          this.status = 'error';
          this.error = {
            code: validateResponse.data.error?.code || validateResponse.data.data?.code || 'VALIDATION_ERROR',
            message: validateResponse.data.error?.message || validateResponse.data.data?.message || 'API密钥验证失败'
          };
          ElMessage.error(this.error.message);
          return false;
        }

        this.status = 'saving';
        const saveResponse = await api.post<ApiResponse<AIConfig>>(`/api/config?t=${timestamp}`, config);
        
        if (saveResponse.data.success && saveResponse.data.data) {
          const savedConfig = saveResponse.data.data;
          
          // 更新本地状态为保存的配置
          this.config = savedConfig;
          
          // 无论如何，都重新加载所有配置以确保数据一致性
          await this.loadConfigs();
          
          this.status = 'ready';
          this.lastUpdated = new Date().toISOString();
          return true;
        } else {
          this.status = 'error';
          this.error = {
            code: saveResponse.data.error?.code || 'SAVE_ERROR',
            message: saveResponse.data.error?.message || '保存配置失败'
          };
          ElMessage.error(this.error.message);
          return false;
        }
      } catch (error: any) {
        console.error('设置配置失败:', error);
        this.status = 'error';
        this.error = {
          code: error.response?.data?.error?.code || 'SAVE_ERROR',
          message: error.response?.data?.error?.message || '保存配置失败'
        };
        ElMessage.error(this.error.message);
        return false;
      } finally {
        this.isProcessing = false;
      }
    },

    // 激活指定配置
    async activateConfig(id: number): Promise<boolean> {
      if (this.isProcessing) return false;
      
      try {
        this.isProcessing = true;
        
        // 添加时间戳参数，确保不使用浏览器缓存
        const timestamp = new Date().getTime();
        const response = await api.post<ApiResponse<AIConfig>>(`/api/config/activate/${id}?t=${timestamp}`);
        
        if (response.data.success && response.data.data) {
          const activatedConfig = response.data.data;
          this.config = activatedConfig;
          
          // 更新本地配置列表
          await this.loadConfigs();
          
          return true;
        } else {
          const errorMessage = response.data.error?.message || '激活配置失败';
          ElMessage.error(errorMessage);
          return false;
        }
      } catch (error: any) {
        console.error('激活配置失败:', error);
        const errorMessage = error.response?.data?.error?.message || error.message || '激活配置失败';
        ElMessage.error(errorMessage);
        return false;
      } finally {
        this.isProcessing = false;
      }
    },

    // 删除配置
    async deleteConfig(id: number): Promise<boolean> {
      if (this.isProcessing) return false;
      
      try {
        this.isProcessing = true;
        
        // 添加时间戳参数，确保不使用浏览器缓存
        const timestamp = new Date().getTime();
        const response = await api.delete<ApiResponse<any>>(`/api/config/${id}?t=${timestamp}`);
        
        if (response.data.success) {
          // 重新加载配置
          await this.loadConfigs();
          
          // 如果删除的是当前活动配置，需要重新设置当前配置
          if (this.allConfigs.length > 0) {
            const activeConfig = this.allConfigs.find(config => config.is_active);
            if (activeConfig) {
              this.config = activeConfig;
              this.status = 'ready';
            } else {
              this.config = this.allConfigs[0];
              this.status = 'ready';
            }
          } else {
            this.config = { model: '', apiKey: '' };
            this.status = 'initial';
          }
          
          return true;
        } else {
          const errorMessage = response.data.error?.message || '删除配置失败';
          ElMessage.error(errorMessage);
          return false;
        }
      } catch (error: any) {
        console.error('删除配置失败:', error);
        const errorMessage = error.response?.data?.error?.message || error.message || '删除配置失败';
        ElMessage.error(errorMessage);
        return false;
      } finally {
        this.isProcessing = false;
      }
    }
  }
});
