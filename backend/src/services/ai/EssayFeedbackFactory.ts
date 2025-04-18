import { AIConfig } from '../../types/api';
import { IIELTSFeedbackFactory, IELTSFeedbackService } from './IELTSFeedbackService';
import { DoubaoFeedbackService } from './strategies/DoubaoFeedbackService';
import { TongyiFeedbackService } from './strategies/TongyiFeedbackService';
import { KimiFeedbackService } from './strategies/KimiFeedbackService';

// 定义支持的考试类型
export enum ExamType {
  IELTS = 'ielts',
  TOEFL = 'toefl',
  GRE = 'gre'
}

/**
 * 作文批改服务工厂类
 * 负责创建不同AI模型和考试类型的批改服务实例
 */
export class EssayFeedbackFactory implements IIELTSFeedbackFactory {
  // 维护支持的AI服务映射
  private static serviceMap: Record<string, new (config: AIConfig) => IELTSFeedbackService> = {
    'doubao': DoubaoFeedbackService,
    'kimi': KimiFeedbackService,
    'tongyi': TongyiFeedbackService,
    // 后续可以添加其他模型支持
    // 'chatgpt': ChatGPTFeedbackService,
  };

  // 每种考试支持的批改服务类型
  private static examServiceMap: Record<ExamType, string[]> = {
    [ExamType.IELTS]: ['doubao', 'kimi', 'tongyi'], // IELTS现在支持豆包、Kimi和通义
    [ExamType.TOEFL]: [], // 托福暂未实现
    [ExamType.GRE]: []  // GRE暂未实现
  };

  /**
   * 创建批改服务实例
   * @param model 模型类型
   * @param config AI配置
   * @param examType 考试类型，默认为IELTS
   * @returns 批改服务实例
   */
  createFeedbackService(model: string, config: AIConfig, examType: ExamType = ExamType.IELTS): IELTSFeedbackService {
    const normalizedModel = model.toLowerCase();
    
    // 检查该考试类型是否支持所选模型
    if (!EssayFeedbackFactory.examServiceMap[examType]?.includes(normalizedModel)) {
      throw new Error(`${examType}考试不支持${model}模型批改`);
    }
    
    // 检查是否支持该模型
    if (!EssayFeedbackFactory.serviceMap[normalizedModel]) {
      throw new Error(`不支持的AI模型类型: ${model}`);
    }
    
    // 创建相应的服务实例
    const ServiceClass = EssayFeedbackFactory.serviceMap[normalizedModel];
    const service = new ServiceClass(config);
    
    return service;
  }

  /**
   * 获取所有支持的服务类型
   * @returns 支持的服务类型列表
   */
  getSupportedServices(): string[] {
    return Object.keys(EssayFeedbackFactory.serviceMap);
  }

  /**
   * 获取特定考试类型支持的服务
   * @param examType 考试类型
   * @returns 该考试类型支持的服务列表
   */
  getSupportedServicesForExam(examType: ExamType): string[] {
    return EssayFeedbackFactory.examServiceMap[examType] || [];
  }

  /**
   * 注册新的服务类型
   * @param modelType 模型类型
   * @param ServiceClass 服务类
   * @param supportedExams 支持的考试类型列表
   */
  static registerService(
    modelType: string, 
    ServiceClass: new (config: AIConfig) => IELTSFeedbackService,
    supportedExams: ExamType[] = [ExamType.IELTS]
  ): void {
    const modelName = modelType.toLowerCase();
    this.serviceMap[modelName] = ServiceClass;
    
    // 为每种支持的考试类型添加此模型
    supportedExams.forEach(examType => {
      if (!this.examServiceMap[examType]) {
        this.examServiceMap[examType] = [];
      }
      if (!this.examServiceMap[examType].includes(modelName)) {
        this.examServiceMap[examType].push(modelName);
      }
    });
  }
} 