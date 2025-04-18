import { Annotation } from '../../models/Feedback';
import { AIConfig } from '../../types/api';
import { ExamType } from './EssayFeedbackFactory';

// IELTS批改服务返回的统一格式
export interface IELTSFeedbackResult {
  // 各项评分 (满分9分)
  scoreTR: number;    // Task Response (任务响应)
  scoreCC: number;    // Coherence and Cohesion (连贯性和衔接)
  scoreLR: number;    // Lexical Resource (词汇资源)
  scoreGRA: number;   // Grammatical Range and Accuracy (语法范围和准确性)
  
  // 各项评语
  feedbackTR: string;
  feedbackCC: string;
  feedbackLR: string;
  feedbackGRA: string;
  
  // 总体评价
  overallFeedback: string;
  
  // 文本注释和修改建议
  annotations: Annotation[];
  
  // token使用统计（便于计费和监控）
  tokenUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

// 批改服务需要的输入
export interface IELTSFeedbackRequest {
  title: string;       // 作文题目
  content: string;     // 作文内容
  prompt?: string;     // 可选的自定义提示词
  targetScore?: string; // 目标分数
  outputFormat?: string; // 可选的输出格式要求
  essayType?: string;   // 作文类型，例如："Task 1" 或 "Task 2"
  examType?: ExamType;  // 考试类型，例如：雅思、托福、GRE等
  projectId?: string;   // 项目ID，用于日志记录和跟踪
  versionNumber?: string; // 版本号，用于日志记录和版本控制
}

// 范文生成返回结果
export interface ExampleEssayResult {
  exampleContent: string;  // 范文内容
  improvement?: string;    // 改进建议
  wordCount: number;       // 字数统计
  
  // token使用统计（便于计费和监控）
  tokenUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

// 所有IELTS批改服务都应实现的接口
export interface IELTSFeedbackService {
  // 初始化服务
  initialize(config: AIConfig): Promise<boolean>;
  
  // 生成作文评分和反馈
  generateFeedback(request: IELTSFeedbackRequest): Promise<IELTSFeedbackResult>;
  
  // 获取评分和反馈（不包含批注）
  getFeedback(request: IELTSFeedbackRequest): Promise<IELTSFeedbackResult>;
  
  // 获取段落批注
  getAnnotation(content: string, context?: {
    paragraphIndex: number;
    allParagraphs: string[];
    feedback?: string;
    targetScore?: string;
    essayType?: string;   // 作文类型
    projectId?: string;   // 项目ID，用于日志记录
    versionNumber?: string; // 版本号，用于日志记录
  }): Promise<Annotation[]>;
  
  // 获取范文
  getExampleEssay(prompt: string, context?: {
    examType?: string;       // 考试类型，例如："雅思"或"托福"
    examCategory?: string;   // 考试类别，例如："Task 1"或"Task 2"
    targetScore?: string;    // 目标分数
    projectId?: number;      // 项目ID，用于日志记录和数据保存
    versionNumber?: number;  // 版本号，用于日志记录和数据保存
    essayContent?: string;   // 学生原文，用于生成针对性的范文和改进建议
  }): Promise<ExampleEssayResult>;
  
  // 验证服务配置
  validateConfig(): Promise<boolean>;
  
  // 获取服务名称
  getServiceName(): string;
  
  // 获取当前服务支持的考试类型
  getExamType(): ExamType;
  
  // 获取批改服务的特性和能力
  getCapabilities(): {
    maxInputTokens: number;
    supportedLanguages: string[];
    hasAnnotationSupport: boolean;
    // 其他特性...
  };
}

// IELTS批改服务工厂接口
export interface IIELTSFeedbackFactory {
  // 创建批改服务
  createFeedbackService(model: string, config: AIConfig, examType?: ExamType): IELTSFeedbackService;
  
  // 获取所有支持的服务
  getSupportedServices(): string[];
  
  // 获取特定考试类型支持的服务
  getSupportedServicesForExam?(examType: ExamType): string[];
} 