import { AIConfig, ValidationResult, ErrorType, ErrorContext } from '../../types/api';
import { ApiError } from '../../middleware/errorHandler';
import { ValidatorFactory } from './validators/ValidatorFactory';

export class ValidationService {
  /**
   * 验证AI配置
   * 不再进行格式验证或其他检查，只通过API调用验证密钥是否有效
   */
  public async validateConfig(config: AIConfig): Promise<ValidationResult> {
    try {
      if (!config.apiKey) {
        return this.createValidationError('API密钥不能为空', 'EMPTY_API_KEY');
      }

      const normalizedApiKey = config.apiKey.trim();
      config.apiKey = normalizedApiKey;
      
      // 使用验证器工厂创建对应模型的验证器
      const validator = ValidatorFactory.createValidator(config.model);
      
      // 调用验证器的验证方法
      return await validator.validate(config);
    } catch (error) {
      console.error('验证过程发生错误:', error);
      if (error instanceof ApiError) {
        return this.createValidationError(error.message, error.code);
      }
      return this.createValidationError('验证过程发生错误', 'VALIDATION_ERROR');
    }
  }

  private createValidationError(message: string, code: string): ValidationResult {
    return {
      isValid: false,
      message,
      code
    };
  }

  public createErrorContext(
    type: ErrorType,
    code: string,
    message: string,
    details?: any
  ): ErrorContext {
    return {
      type,
      code,
      message,
      details
    };
  }
} 