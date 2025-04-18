import { ApiError } from '../../middleware/errorHandler';
import { BaseService } from '../base';
import { AIConfig, ValidateResponse, ValidationResult } from '../../types/api';
import { ValidationService } from '../validation/ValidationService';
import { ConfigService } from '../config/ConfigService';

export interface IELTSResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export class IELTSService extends BaseService {
  private config: AIConfig;
  private validationService: ValidationService;
  private configService: ConfigService;
  private modelConfigs: any;

  constructor(config: AIConfig) {
    super();
    this.config = config;
    this.validationService = new ValidationService();
    this.configService = new ConfigService();
    this.modelConfigs = config.modelConfigs || {};
  }

  public async validateApiKey(): Promise<ValidateResponse> {
    console.log('IELTSService正在验证配置:', JSON.stringify(this.config, null, 2));
    const validationResult = await this.validationService.validateConfig(this.config);
    console.log('IELTSService验证结果:', JSON.stringify(validationResult, null, 2));
    return {
      isValid: validationResult.isValid,
      message: validationResult.message,
      code: validationResult.code
    };
  }

  async getActiveConfig(): Promise<AIConfig | null> {
    try {
      const activeConfig = await this.configService.getActiveConfig();
      if (!activeConfig) {
        return null;
      }

      return {
        model: activeConfig.model,
        apiKey: activeConfig.apiKey,
        ...activeConfig.modelConfigs
      };
    } catch (error) {
      console.error('获取活动配置失败:', error);
      throw new ApiError('获取活动配置失败', 'CONFIG_FETCH_ERROR', 500);
    }
  }

  async generateEssayFeedback(essay: string): Promise<IELTSResponse> {
    try {
      // 获取当前活动配置
      const activeConfig = await this.getActiveConfig();
      if (!activeConfig) {
        throw new ApiError('未找到活动配置', 'NO_ACTIVE_CONFIG', 404);
      }

      // 在生成反馈前验证配置
      const validationResult = await this.validationService.validateConfig(activeConfig);
      if (!validationResult.isValid) {
        throw new ApiError(validationResult.message || '配置验证失败', validationResult.code || 'VALIDATION_ERROR');
      }

      // TODO: 实现AI评分和反馈逻辑
      return {
        content: '这是一个示例反馈',
        usage: {
          promptTokens: 100,
          completionTokens: 50,
          totalTokens: 150
        }
      };
    } catch (error) {
      throw new ApiError('生成反馈失败');
    }
  }

  async generateEssayImprovement(essay: string): Promise<IELTSResponse> {
    try {
      // 获取当前活动配置
      const activeConfig = await this.getActiveConfig();
      if (!activeConfig) {
        throw new ApiError('未找到活动配置', 'NO_ACTIVE_CONFIG', 404);
      }

      // 在生成改进建议前验证配置
      const validationResult = await this.validationService.validateConfig(activeConfig);
      if (!validationResult.isValid) {
        throw new ApiError(validationResult.message || '配置验证失败', validationResult.code || 'VALIDATION_ERROR');
      }

      // TODO: 实现AI改进建议生成逻辑
      return {
        content: '这是一个示例改进建议',
        usage: {
          promptTokens: 100,
          completionTokens: 50,
          totalTokens: 150
        }
      };
    } catch (error) {
      throw new ApiError('生成改进建议失败');
    }
  }
}