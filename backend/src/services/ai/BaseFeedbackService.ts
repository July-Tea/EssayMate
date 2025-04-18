import { AIConfig } from '../../types/api';
import { IELTSFeedbackRequest, IELTSFeedbackResult, IELTSFeedbackService } from './IELTSFeedbackService';
import { ValidationService } from '../validation/ValidationService';
import { Annotation } from '../../models/Feedback';
import { ExamType } from './EssayFeedbackFactory';
import { v4 as uuidv4 } from 'uuid';
import { PromptLogModel } from '../../models/PromptLog';
import { getDatabaseConnection } from '../../data-source';

/**
 * 批改服务抽象基类
 * 提供共用功能和默认实现
 */
export abstract class BaseFeedbackService implements IELTSFeedbackService {
  protected config: AIConfig;
  protected isInitialized: boolean = false;
  protected validationService: ValidationService;
  protected examType: ExamType;
  protected promptLogModel: PromptLogModel;
  
  constructor(config: AIConfig, examType: ExamType = ExamType.IELTS) {
    this.config = config;
    this.validationService = new ValidationService();
    this.examType = examType;
    this.promptLogModel = new PromptLogModel(getDatabaseConnection());
  }
  
  /**
   * 初始化服务，验证配置是否有效
   * @param config AI配置
   */
  async initialize(config: AIConfig): Promise<boolean> {
    this.config = config;
    const isValid = await this.validateConfig();
    this.isInitialized = isValid;
    return isValid;
  }
  
  /**
   * 验证服务配置
   */
  async validateConfig(): Promise<boolean> {
    try {
      const validationResult = await this.validationService.validateConfig(this.config);
      return validationResult.isValid;
    } catch (error) {
      console.error('配置验证失败:', error);
      return false;
    }
  }
  
  /**
   * 生成作文评分和反馈 (抽象方法，子类必须实现)
   * @param request 批改请求
   */
  abstract generateFeedback(request: IELTSFeedbackRequest): Promise<IELTSFeedbackResult>;
  
  /**
   * 获取评分和反馈（不包含批注）
   * @param request 批改请求
   */
  async getFeedback(request: IELTSFeedbackRequest): Promise<IELTSFeedbackResult> {
    // 默认实现：调用generateFeedback但忽略批注
    const result = await this.generateFeedback(request);
    result.annotations = [];
    return result;
  }
  
  /**
   * 获取段落批注
   * @param content 段落内容
   * @param context 上下文信息（段落索引、所有段落、反馈信息等）
   */
  async getAnnotation(content: string, context?: {
    paragraphIndex: number;
    allParagraphs: string[];
    feedback?: string;
    targetScore?: string;
    essayType?: string;
  }): Promise<Annotation[]> {
    // 基础实现：返回空批注
    // 子类需要覆盖此方法提供实际的批注生成逻辑
    console.log('调用基础getAnnotation方法，需要子类实现具体逻辑');
    return [];
  }
  
  /**
   * 转换段落批注位置为全文位置
   * @param annotations 段落批注
   * @param paragraphIndex 段落索引
   * @param allParagraphs 所有段落
   * @returns 调整后的批注
   */
  protected convertToAbsolutePosition(annotations: Annotation[], paragraphIndex: number, allParagraphs: string[]): Annotation[] {
    let offset = 0;
    
    // 计算当前段落之前所有段落的文本长度及分隔符
    for (let i = 0; i < paragraphIndex; i++) {
      offset += allParagraphs[i].length + 2; // +2 表示'\n\n'分隔符
    }
    
    // 返回原始批注，不再处理position字段，因为新的Annotation接口已删除该字段
    return annotations.map(annotation => ({
      ...annotation
    }));
  }
  
  /**
   * 获取服务名称 (抽象方法，子类必须实现)
   */
  abstract getServiceName(): string;
  
  /**
   * 获取批改服务的特性和能力 (可被子类覆盖)
   */
  getCapabilities(): {
    maxInputTokens: number;
    supportedLanguages: string[];
    hasAnnotationSupport: boolean;
  } {
    return {
      maxInputTokens: 4000,
      supportedLanguages: ['zh-CN', 'en-US'],
      hasAnnotationSupport: true
    };
  }
  
  /**
   * 获取当前服务支持的考试类型
   */
  getExamType(): ExamType {
    return this.examType;
  }
  
  /**
   * 构建基础提示词
   * @param title 作文题目
   * @param content 作文内容
   * @param customPrompt 自定义提示词
   */
  protected buildBasePrompt(title: string, content: string, customPrompt?: string): string {
    // 根据不同考试类型构建不同的基础提示词
    switch (this.examType) {
      case ExamType.IELTS:
        return this.buildIELTSPrompt(title, content, customPrompt);
      case ExamType.TOEFL:
        return this.buildTOEFLPrompt(title, content, customPrompt);
      case ExamType.GRE:
        return this.buildGREPrompt(title, content, customPrompt);
      default:
        return this.buildIELTSPrompt(title, content, customPrompt);
    }
  }
  
  /**
   * 构建IELTS提示词
   */
  protected buildIELTSPrompt(title: string, content: string, customPrompt?: string): string {
    let basePrompt = `
作文题目: ${title}

作文内容:
${content}

请对上述雅思(IELTS)作文进行详细评分和批改，需要提供以下几个方面的评价:
1. Task Response (任务响应): 评分 + 详细评语
2. Coherence and Cohesion (连贯性和衔接): 评分 + 详细评语
3. Lexical Resource (词汇资源): 评分 + 详细评语
4. Grammatical Range and Accuracy (语法范围和准确性): 评分 + 详细评语
5. 总体评价
6. 具体的文本批注和修改建议

评分标准: 
- 分数范围为0-9分
- 评分时请考虑语言准确性、内容相关性、结构连贯性、词汇多样性
`;

    if (customPrompt) {
      basePrompt += `\n${customPrompt}`;
    }

    return basePrompt;
  }
  
  /**
   * 构建TOEFL提示词
   */
  protected buildTOEFLPrompt(title: string, content: string, customPrompt?: string): string {
    let basePrompt = `
作文题目: ${title}

作文内容:
${content}

请对上述托福(TOEFL)作文进行详细评分和批改，需要提供以下几个方面的评价:
1. 内容完整性与发展: 评分 + 详细评语
2. 组织结构: 评分 + 详细评语
3. 语言使用: 评分 + 详细评语
4. 语法多样性与准确性: 评分 + 详细评语
5. 总体评价
6. 具体的文本批注和修改建议

评分标准: 
- 分数范围为0-30分
- 评分时请考虑论点发展、观点支持、组织结构、语言使用等方面
`;

    if (customPrompt) {
      basePrompt += `\n${customPrompt}`;
    }

    return basePrompt;
  }
  
  /**
   * 构建GRE提示词
   */
  protected buildGREPrompt(title: string, content: string, customPrompt?: string): string {
    let basePrompt = `
作文题目: ${title}

作文内容:
${content}

请对上述GRE作文进行详细评分和批改，需要提供以下几个方面的评价:
1. 论证分析: 评分 + 详细评语
2. 论点发展: 评分 + 详细评语
3. 组织结构: 评分 + 详细评语
4. 语言使用: 评分 + 详细评语
5. 总体评价
6. 具体的文本批注和修改建议

评分标准: 
- 分数范围为0-6分
- 评分时请考虑分析深度、论点支持的充分性、逻辑组织、语言准确性和多样性
`;

    if (customPrompt) {
      basePrompt += `\n${customPrompt}`;
    }

    return basePrompt;
  }
  
  /**
   * 处理原始的AI响应到统一格式
   * 默认实现，具体服务可能需要重写
   * @param rawResponse AI原始响应
   */
  protected abstract processResponse(rawResponse: any): IELTSFeedbackResult;

  /**
   * 总结文本内容，以减少token使用
   * @param content 原始内容
   * @param maxLength 最大长度
   * @returns 总结后的内容
   */
  protected summarizeContent(content: string, maxLength: number = 1000): string {
    // 如果内容小于最大长度，直接返回
    if (content.length <= maxLength) {
      return content;
    }
    
    // 找到段落分隔符
    const paragraphs = content.split(/\n\s*\n/);
    
    // 如果只有一个段落，截断显示
    if (paragraphs.length <= 1) {
      return content.substring(0, maxLength) + '...';
    }
    
    // 如果段落数大于5，保留开头和结尾的段落
    if (paragraphs.length > 5) {
      const firstParagraphs = paragraphs.slice(0, 2).join('\n\n');
      const lastParagraphs = paragraphs.slice(-2).join('\n\n');
      
      // 计算中间部分可用的最大长度
      const remainingLength = maxLength - firstParagraphs.length - lastParagraphs.length - 20;
      const middleParagraphs = paragraphs.slice(2, -2);
      
      // 提取中间段落的关键部分
      let middleContent = '';
      if (remainingLength > 100 && middleParagraphs.length > 0) {
        const sampleSize = Math.floor(remainingLength / middleParagraphs.length);
        middleContent = middleParagraphs.map(p => 
          p.length <= sampleSize ? p : p.substring(0, sampleSize) + '...'
        ).join('\n\n');
      } else {
        middleContent = '...';
      }
      
      return `${firstParagraphs}\n\n${middleContent}\n\n${lastParagraphs}`;
    }
    
    // 如果段落较少，尝试保留所有段落，但截断每个段落
    const maxParagraphLength = Math.floor(maxLength / paragraphs.length) - 10;
    return paragraphs.map(p => 
      p.length <= maxParagraphLength ? p : p.substring(0, maxParagraphLength) + '...'
    ).join('\n\n');
  }

  /**
   * 记录提示词请求日志
   * @param requestId 请求ID
   * @param requestType 请求类型
   * @param paragraphInfo 段落信息 
   * @param projectId 项目ID
   * @param versionNumber 版本号
   * @param promptContent 提示词内容
   * @param rawResponse 原始响应
   * @param responseContent 处理后的响应内容
   * @param tokenUsageDetail Token使用详情
   * @param duration 请求耗时（毫秒）
   * @param status 请求状态
   * @param errorMessage 错误信息
   */
  protected async logPromptRequest(
    requestId: string,
    requestType: 'feedback' | 'annotation' | 'example_essay',
    paragraphInfo: string,
    projectId: number | undefined,
    versionNumber: number | undefined,
    promptContent: string,
    rawResponse: string,
    responseContent: string,
    tokenUsageDetail: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    },
    duration: number,
    status: 'success' | 'error',
    errorMessage?: string
  ): Promise<void> {
    try {
      await this.promptLogModel.create({
        serviceType: this.getServiceName(),
        modelName: this.config.model_name || 'unknown',
        requestId,
        requestType,
        paragraphInfo,
        projectId,
        versionNumber,
        promptContent,
        rawResponse,
        responseContent,
        tokenUsage: tokenUsageDetail.totalTokens,
        tokenUsageDetail,
        duration,
        status,
        errorMessage
      });
      console.log(`[${this.getServiceName()}] 记录请求日志成功: ${requestId} | 类型: ${requestType} | 段落: ${paragraphInfo}`);
    } catch (error) {
      console.error(`[${this.getServiceName()}] 记录请求日志失败:`, error);
    }
  }

  /**
   * 生成唯一的请求ID
   */
  protected generateRequestId(): string {
    return uuidv4();
  }

  /**
   * 生成范文
   * @param prompt 作文题目
   * @param context 上下文信息（考试类型、考试类别、目标分数等）
   */
  async getExampleEssay(prompt: string, context?: {
    examType?: string;
    examCategory?: string;
    targetScore?: string;
    projectId?: number;
    versionNumber?: number;
    essayContent?: string;
  }): Promise<{
    exampleContent: string;
    improvement?: string;
    wordCount: number;
    tokenUsage?: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
  }> {
    // 基础实现：返回空范文
    // 子类需要覆盖此方法提供实际的范文生成逻辑
    console.log('调用基础getExampleEssay方法，需要子类实现具体逻辑');
    return {
      exampleContent: '',
      improvement: '',
      wordCount: 0,
      tokenUsage: {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0
      }
    };
  }
} 