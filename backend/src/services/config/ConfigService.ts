import { Repository, Not } from 'typeorm';
import { Config } from '../../models/Config';
import { AppDataSource } from '../../data-source';
import { ApiError } from '../../middleware/errorHandler';
import { AIConfig } from '../../types/api';

export class ConfigService {
  private configRepository: Repository<Config>;
  private static readonly MAX_RETRIES = 3;
  private static readonly RETRY_DELAY = 1000; // 1秒

  constructor() {
    this.configRepository = AppDataSource.getRepository(Config);
  }

  private async withRetry<T>(operation: () => Promise<T>, retries = ConfigService.MAX_RETRIES): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      console.error('数据库操作失败:', error);
      if (retries > 0) {
        console.log(`正在重试操作... (剩余 ${retries} 次尝试)`);
        await new Promise(resolve => setTimeout(resolve, ConfigService.RETRY_DELAY));
        return this.withRetry(operation, retries - 1);
      }
      throw error;
    }
  }

  async getProgramState(): Promise<any> {
    return this.withRetry(async () => {
      try {
        const activeConfig = await this.getActiveConfig();
        return activeConfig?.programState || null;
      } catch (error) {
        console.error('获取程序状态失败:', error);
        throw new ApiError('获取程序状态失败', 'PROGRAM_STATE_ERROR', 500);
      }
    });
  }

  async updateProgramState(state: any): Promise<Config> {
    return this.withRetry(async () => {
      try {
        let config = await this.getActiveConfig();
        if (!config) {
          throw new ApiError('未找到活动配置', 'NO_ACTIVE_CONFIG', 404);
        }
        config.programState = state;
        return await this.configRepository.save(config);
      } catch (error) {
        console.error('更新程序状态失败:', error);
        throw new ApiError('更新程序状态失败', 'PROGRAM_STATE_UPDATE_ERROR', 500);
      }
    });
  }

  // 获取当前活动的配置
  async getActiveConfig(): Promise<Config | null> {
    return this.withRetry(async () => {
      try {
        const configs = await this.configRepository.find({
          where: { is_active: true },
          order: { updated_at: 'DESC' },
          take: 1
        });
        
        const config = configs[0] || null;
        
        if (!config) {
          console.log('未找到活动配置，将返回null');
        }
        
        return config;
      } catch (error) {
        console.error('获取活动配置失败:', error);
        throw new ApiError('获取活动配置失败', 'CONFIG_FETCH_ERROR', 500);
      }
    });
  }
  
  // 获取所有配置
  async getAllConfigs(): Promise<Config[]> {
    return this.withRetry(async () => {
      try {
        return await this.configRepository.find({
          order: { updated_at: 'DESC' }
        });
      } catch (error) {
        console.error('获取所有配置失败:', error);
        throw new ApiError('获取所有配置失败', 'CONFIG_FETCH_ERROR', 500);
      }
    });
  }
  
  /**
   * 获取活跃AI模型的配置
   * 这是一个专门用于AI服务的方法，返回当前活跃的AI模型配置
   * 如果没有活跃配置，抛出错误
   * @returns 活跃的AI模型配置
   */
  async getActiveAIModelConfig(): Promise<Config> {
    return this.withRetry(async () => {
      try {
        // 获取当前活跃的配置
        const activeConfig = await this.getActiveConfig();
        
        if (!activeConfig) {
          throw new ApiError('未找到活动的AI模型配置', 'NO_ACTIVE_MODEL_CONFIG', 404);
        }
        
        console.log(`获取活跃AI模型配置 | 模型: ${activeConfig.model}`);
        return activeConfig;
      } catch (error) {
        if (error instanceof ApiError) {
          throw error;
        }
        console.error('获取活跃AI模型配置失败:', error);
        throw new ApiError('获取活跃AI模型配置失败', 'CONFIG_FETCH_ERROR', 500);
      }
    });
  }
  
  // 获取指定模型的配置
  async getConfigByModel(model: string): Promise<Config | null> {
    return this.withRetry(async () => {
      try {
        const configs = await this.configRepository.find({
          where: { model },
          order: { updated_at: 'DESC' },
          take: 1
        });
        
        return configs[0] || null;
      } catch (error) {
        console.error(`获取模型 ${model} 的配置失败:`, error);
        throw new ApiError('获取模型配置失败', 'CONFIG_FETCH_ERROR', 500);
      }
    });
  }

  // 验证API密钥不为空
  private validateApiKey(apiKey: string): void {
    if (!apiKey || apiKey.trim().length === 0) {
      throw new ApiError('API密钥不能为空', 'INVALID_API_KEY', 400);
    }
  }

  // 保存或更新配置
  async saveConfig(aiConfig: AIConfig): Promise<Config> {
    return this.withRetry(async () => {
      try {
        const { model, apiKey, ...otherProps } = aiConfig;
        
        if (!model || !apiKey) {
          throw new ApiError('模型和API密钥不能为空', 'INVALID_PARAMS', 400);
        }
        
        this.validateApiKey(apiKey);
        
        // 查找是否已存在该模型的配置
        let config = await this.getConfigByModel(model);
        
        // 如果不存在，则创建新配置
        if (!config) {
          config = new Config();
          console.log(`创建新的 ${model} 配置`);
        } else {
          console.log(`更新已有的 ${model} 配置`);
        }
        
        // 设置配置属性
        config.model = model.trim();
        config.apiKey = apiKey.trim();
        
        // 处理modelConfigs，确保不冗余存储
        const modelLower = model.toLowerCase();
        if ((modelLower === 'doubao' || modelLower === 'tongyi' || modelLower === 'kimi') && otherProps.model_name) {
          // 需要model_name的模型只保留model_name属性
          config.modelConfigs = { model_name: otherProps.model_name };
        } else {
          // 其他模型根据需要存储其他属性，但过滤掉可能导致冗余的属性
          delete otherProps.modelConfigs; // 避免嵌套存储modelConfigs
          config.modelConfigs = { ...otherProps };
        }
        
        // 先将所有配置设为非活动状态
        await this.configRepository.update({}, { is_active: false });
        
        // 将当前配置设为活动状态
        config.is_active = true;
        
        // 保存配置
        const savedConfig = await this.configRepository.save(config);
        console.log('配置保存成功:', { 
          model: savedConfig.model, 
          id: savedConfig.id, 
          is_active: savedConfig.is_active,
          modelConfigs: savedConfig.modelConfigs
        });
        
        return savedConfig;
      } catch (error) {
        console.error('保存配置失败:', error);
        if (error instanceof ApiError) {
          throw error;
        }
        throw new ApiError('保存配置失败', 'CONFIG_SAVE_ERROR', 500);
      }
    });
  }

  // 激活指定的配置
  async activateConfig(id: number): Promise<Config> {
    return this.withRetry(async () => {
      try {
        // 找到要激活的配置
        const config = await this.configRepository.findOneBy({ id });
        if (!config) {
          throw new ApiError('配置不存在', 'CONFIG_NOT_FOUND', 404);
        }
        
        // 先将所有配置设为非活动
        await this.configRepository.update({ is_active: true }, { is_active: false });
        
        // 将指定配置设为活动
        config.is_active = true;
        const activatedConfig = await this.configRepository.save(config);
        
        console.log('配置已激活:', { model: activatedConfig.model, id: activatedConfig.id });
        return activatedConfig;
      } catch (error) {
        console.error('激活配置失败:', error);
        if (error instanceof ApiError) {
          throw error;
        }
        throw new ApiError('激活配置失败', 'CONFIG_ACTIVATION_ERROR', 500);
      }
    });
  }
  
  // 删除配置
  async deleteConfig(id: number): Promise<void> {
    return this.withRetry(async () => {
      try {
        const config = await this.configRepository.findOneBy({ id });
        if (!config) {
          throw new ApiError('配置不存在', 'CONFIG_NOT_FOUND', 404);
        }
        
        // 如果要删除的是活动配置，则需要确保有其他配置可用
        if (config.is_active) {
          const otherConfigs = await this.configRepository.find({
            where: { id: Not(id) },
            order: { updated_at: 'DESC' },
            take: 1
          });
          
          // 如果有其他配置，则将第一个设为活动
          if (otherConfigs.length > 0) {
            await this.activateConfig(otherConfigs[0].id);
          }
        }
        
        await this.configRepository.remove(config);
        console.log('配置已删除:', { id, model: config.model });
      } catch (error) {
        console.error('删除配置失败:', error);
        if (error instanceof ApiError) {
          throw error;
        }
        throw new ApiError('删除配置失败', 'CONFIG_DELETE_ERROR', 500);
      }
    });
  }

  // 新增：检查指定模型是否已经有配置
  async hasModelConfig(model: string): Promise<boolean> {
    return this.withRetry(async () => {
      try {
        const config = await this.getConfigByModel(model);
        return config !== null;
      } catch (error) {
        console.error(`检查模型 ${model} 配置失败:`, error);
        throw new ApiError('检查模型配置失败', 'CONFIG_CHECK_ERROR', 500);
      }
    });
  }

  // 新增：获取当前正在使用的AI模型配置
  async getCurrentAIModel(): Promise<string | null> {
    return this.withRetry(async () => {
      try {
        const activeConfig = await this.getActiveConfig();
        if (!activeConfig) {
          return null;
        }
        return activeConfig.model;
      } catch (error) {
        console.error('获取当前AI模型失败:', error);
        throw new ApiError('获取当前AI模型失败', 'CONFIG_FETCH_ERROR', 500);
      }
    });
  }

  // 新增：检查是否有任何已配置的AI模型
  async hasAnyConfig(): Promise<boolean> {
    return this.withRetry(async () => {
      try {
        const configs = await this.getAllConfigs();
        return configs.length > 0;
      } catch (error) {
        console.error('检查配置失败:', error);
        throw new ApiError('检查配置失败', 'CONFIG_CHECK_ERROR', 500);
      }
    });
  }
}