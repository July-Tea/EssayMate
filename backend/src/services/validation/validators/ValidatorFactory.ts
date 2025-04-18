import { AIConfig, ValidationResult } from '../../../types/api';
import { DoubaoValidator } from './DoubaoValidator';
import { KimiValidator } from './KimiValidator';
import { TongyiValidator } from './TongyiValidator';

/**
 * 验证器接口，所有模型验证器都应实现这个接口
 */
export interface IValidator {
  validate(config: AIConfig): Promise<ValidationResult>;
}

/**
 * 验证器工厂类，负责创建不同模型的验证器
 */
export class ValidatorFactory {
  /**
   * 根据模型类型创建对应的验证器
   * @param modelType 模型类型
   * @returns 对应模型的验证器实例
   */
  public static createValidator(modelType: string): IValidator {
    switch (modelType.toLowerCase()) {
      case 'doubao':
        return new DoubaoValidator();
      case 'kimi':
        return new KimiValidator();
      case 'tongyi':
        return new TongyiValidator();
      default:
        // 对于未实现的模型，返回默认的豆包验证器
        console.warn(`未找到模型类型 ${modelType} 的验证器，使用豆包验证器代替`);
        return new DoubaoValidator();
    }
  }
} 