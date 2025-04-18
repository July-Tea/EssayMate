import OpenAI from 'openai';
import { AIConfig } from '../../../types/api';
import { Annotation } from '../../../models/Feedback';
import { IELTSFeedbackRequest, IELTSFeedbackResult, ExampleEssayResult } from '../IELTSFeedbackService';
import { BaseFeedbackService } from '../BaseFeedbackService';
import { ApiError } from '../../../middleware/errorHandler';
import { PromptTemplate } from '../prompts/PromptTemplate';
import PromptManager, { PromptType, EssayTaskType } from '../prompts/PromptManager';
import { ExamType } from '../EssayFeedbackFactory';

/**
 * Kimi批改服务实现类
 */
export class KimiFeedbackService extends BaseFeedbackService {
  // Kimi API基础URL
  private static readonly BASE_URL = 'https://api.moonshot.cn/v1';
  
  // Kimi模型名称
  private static readonly MODEL_NAME = 'kimi';
  
  // 默认使用的模型
  private static readonly DEFAULT_MODEL = 'moonshot-v1-8k';
  
  // OpenAI客户端
  private client: any; // 使用any类型避免OpenAI类型错误
  
  // Token使用统计
  private tokenUsageStats = {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0
  };
  
  constructor(config: AIConfig, examType: ExamType = ExamType.IELTS) {
    super(config, examType);
    
    // 初始化OpenAI客户端（使用Kimi的API地址）
    this.client = new OpenAI({
      apiKey: config.apiKey || 'MOONSHOT_API_KEY',
      baseURL: KimiFeedbackService.BASE_URL
    });
  }
  
  /**
   * 获取服务名称
   */
  getServiceName(): string {
    return 'Kimi';
  }
  
  /**
   * 获取Kimi服务的特性和能力
   */
  getCapabilities(): {
    maxInputTokens: number;
    supportedLanguages: string[];
    hasAnnotationSupport: boolean;
  } {
    return {
      maxInputTokens: 8000,  // Kimi 8k模型支持的最大输入token
      supportedLanguages: ['zh-CN', 'en-US'],
      hasAnnotationSupport: true
    };
  }
  
  /**
   * 生成作文批改反馈
   * @param request 批改请求
   * @returns 批改结果
   */
  async generateFeedback(request: IELTSFeedbackRequest): Promise<IELTSFeedbackResult> {
    try {
      // 获取项目ID和版本号
      const projectId = request.projectId || '未指定';
      const versionNumber = request.versionNumber || '未指定';
      
      console.log(`[${this.getServiceName()}] [项目ID: ${projectId}] [版本: ${versionNumber}] 开始作文批改 | 考试类型: ${this.examType}`);
      
      // 重置token使用统计
      this.resetTokenUsage();
      
      // 一次性批改策略
      const result = await this.generateSingleStepFeedback(request);
      
      // 添加token使用统计
      result.tokenUsage = { ...this.tokenUsageStats };
      console.log(`[${this.getServiceName()}] [项目ID: ${projectId}] [版本: ${versionNumber}] 作文批改完成 | Token: ${result.tokenUsage.totalTokens} | 评分: TR=${result.scoreTR}, CC=${result.scoreCC}, LR=${result.scoreLR}, GRA=${result.scoreGRA}`);
      
      return result;
    } catch (error: any) {
      const projectId = request.projectId || '未指定';
      const versionNumber = request.versionNumber || '未指定';
      console.error(`[${this.getServiceName()}] [项目ID: ${projectId}] [版本: ${versionNumber}] 批改失败 | 错误: ${error.message}`);
      
      if (error instanceof ApiError) {
        throw error;
      }
      
      if (error.response) {
        // 服务器错误
        const status = error.response.status;
        const errorData = error.response.data;
        throw new ApiError(
          `${this.getServiceName()}API服务器错误 (${status}): ${JSON.stringify(errorData)}`, 
          'KIMI_API_ERROR'
        );
      } else if (error.request) {
        // 请求错误
        throw new ApiError(`无法连接到${this.getServiceName()}API服务器`, 'CONNECTION_ERROR');
      } else {
        // 其他错误
        throw new ApiError(`批改过程发生错误: ${error.message}`, 'PROCESSING_ERROR');
      }
    }
  }
  
  /**
   * 一次性批改策略
   * @param request 批改请求
   */
  private async generateSingleStepFeedback(request: IELTSFeedbackRequest): Promise<IELTSFeedbackResult> {
    const projectId = request.projectId || '未指定';
    const versionNumber = request.versionNumber || '未指定';
    
    // 处理作文类型，将其转换为适合的任务类型
    const taskType = this.getTaskTypeFromRequest(request);
    console.log(`[${this.getServiceName()}] [项目ID: ${projectId}] [版本: ${versionNumber}] 识别任务类型: ${taskType}`);
    
    // 使用配置中的模型名称
    const modelName = this.config.model_name || KimiFeedbackService.DEFAULT_MODEL;
    console.log(`[${this.getServiceName()}] [项目ID: ${projectId}] [版本: ${versionNumber}] 使用模型: ${modelName}`);
    
    // 获取对应的提示词模板
    const promptConfig = await PromptManager.getPrompt(
      KimiFeedbackService.MODEL_NAME, // 这里只是用于模板查找
      this.examType.toLowerCase(),
      taskType,
      PromptType.FEEDBACK
    );
    
    // 创建提示词模板实例
    const template = new PromptTemplate(promptConfig);
    
    // 构建模板数据
    const templateData = {
      title: request.title,
      content: request.content,
      customPrompt: request.prompt,
      targetScore: request.targetScore
    };
    
    // 渲染提示词
    const prompt = template.render(templateData);
    console.log(`[${this.getServiceName()}] [项目ID: ${projectId}] [版本: ${versionNumber}] 使用提示词 | 模型: ${modelName} | 使用模板: ${KimiFeedbackService.MODEL_NAME} | 考试: ${this.examType} | 任务: ${taskType}`);
    
    if (request.prompt) {
      console.log(`[${this.getServiceName()}] [项目ID: ${projectId}] [版本: ${versionNumber}] 自定义提示词: ${request.prompt}`);
    }
    
    // 调用API
    console.log(`[${this.getServiceName()}] [项目ID: ${projectId}] [版本: ${versionNumber}] 正在调用API...`);
    const responseContent = await this.callKimiAPI(
      prompt.systemMessage, 
      prompt.userMessage, 
      modelName, 
      projectId, 
      versionNumber,
      'feedback',
      '1/1'
    );
    
    // 处理响应
    return this.processResponse(responseContent);
  }
  
  /**
   * 根据请求确定任务类型
   * @param request 批改请求
   * @returns 任务类型
   */
  private getTaskTypeFromRequest(request: IELTSFeedbackRequest): string {
    const essayType = request.essayType || '';
    const examType = this.examType.toLowerCase();
    
    if (examType === 'ielts') {
      if (essayType.includes('Task 1') || essayType.includes('Writing1')) {
        return EssayTaskType.IELTS_TASK1;
      } else if (essayType.includes('Task 2') || essayType.includes('Writing2')) {
        return EssayTaskType.IELTS_TASK2;
      }
      // 默认为Task 2
      return EssayTaskType.IELTS_TASK2;
    } else if (examType === 'toefl') {
      return EssayTaskType.TOEFL;
    } else if (examType === 'gre') {
      return EssayTaskType.GRE;
    }
    
    // 默认返回通用类型
    return EssayTaskType.GENERAL;
  }
  
  /**
   * 调用Kimi API
   * @param systemMessage 系统消息
   * @param userMessage 用户消息
   * @param modelName 模型名称
   * @param projectId 项目ID
   * @param versionNumber 版本号
   * @param requestType 请求类型
   * @param paragraphInfo 段落信息
   * @returns 响应内容
   */
  private async callKimiAPI(
    systemMessage: string, 
    userMessage: string,
    modelName: string = KimiFeedbackService.DEFAULT_MODEL,
    projectId: string = '未指定',
    versionNumber: string = '未指定',
    requestType: 'feedback' | 'annotation' | 'example_essay' = 'feedback',
    paragraphInfo: string = '1/1'
  ): Promise<string> {
    // 生成唯一请求ID
    const requestId = this.generateRequestId();
    const startTime = Date.now();
    let status: 'success' | 'error' = 'success';
    let errorMessage: string | undefined;
    let responseContent = '';
    let rawResponse = '';
    
    const chatMessages = [
      { role: 'system', content: systemMessage },
      { role: 'user', content: userMessage }
    ];
    
    // 打印提交到API的消息内容以便调试
    console.log(`│ [${this.getServiceName()}] [请求ID: ${requestId}] [类型: ${requestType}] [段落: ${paragraphInfo}] [项目ID: ${projectId}] [版本: ${versionNumber}] API请求详情`);
    
    // 检查API密钥
    if (!this.config.apiKey) {
      errorMessage = `${this.getServiceName()}API密钥未设置`;
      status = 'error';
      
      // 创建默认的token使用情况对象
      const defaultTokens = {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0
      };
      
      // 记录日志
      await this.logPromptRequest(
        requestId,
        requestType,
        paragraphInfo,
        projectId !== '未指定' ? parseInt(projectId) : undefined,
        versionNumber !== '未指定' ? parseInt(versionNumber) : undefined,
        JSON.stringify(chatMessages),
        '',
        '',
        defaultTokens,
        Date.now() - startTime,
        status,
        errorMessage
      );
      
      throw new ApiError(errorMessage, 'API_KEY_MISSING');
    }

    try {
      console.log(`[${this.getServiceName()}] [请求ID: ${requestId}] [类型: ${requestType}] [段落: ${paragraphInfo}] [项目ID: ${projectId}] [版本: ${versionNumber}] 调用API | 模型: ${modelName}`);
      
      const response = await this.client.chat.completions.create({
        model: modelName,
        messages: chatMessages,
        temperature: 0.3,
      });
      
      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000;
      
      console.log(`[${this.getServiceName()}] [请求ID: ${requestId}] [类型: ${requestType}] [段落: ${paragraphInfo}] [项目ID: ${projectId}] [版本: ${versionNumber}] API响应 | 耗时: ${duration.toFixed(2)}秒`);
      
      // 记录token使用情况
      if (response.usage) {
        this.addTokenUsage(
          response.usage.prompt_tokens || 0,
          response.usage.completion_tokens || 0
        );
      }
      
      // 保存原始响应
      rawResponse = JSON.stringify(response);
      
      const content = response.choices[0].message.content || '';
      responseContent = content;
      
      // 记录API返回的原始内容
      console.log(`│ [${this.getServiceName()}] [请求ID: ${requestId}] [类型: ${requestType}] [段落: ${paragraphInfo}] [项目ID: ${projectId}] [版本: ${versionNumber}] API返回原始内容`);
      
      // 创建请求特定的token使用详情对象，不使用累加的tokenUsageStats
      const currentRequestTokens = {
        promptTokens: response.usage?.prompt_tokens || 0,
        completionTokens: response.usage?.completion_tokens || 0,
        totalTokens: response.usage?.total_tokens || 0
      };
      
      // 记录成功的请求日志
      await this.logPromptRequest(
        requestId,
        requestType,
        paragraphInfo,
        projectId !== '未指定' ? parseInt(projectId) : undefined,
        versionNumber !== '未指定' ? parseInt(versionNumber) : undefined,
        JSON.stringify(chatMessages),
        rawResponse,
        responseContent,
        currentRequestTokens, // 使用当前请求的token使用情况
        endTime - startTime,
        'success'
      );
      
      return content;
    } catch (error: any) {
      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000;
      status = 'error';
      
      console.error(`\n┌────────────────────────────────────────────────────────────────────`);
      console.error(`│ [${this.getServiceName()}] [请求ID: ${requestId}] [类型: ${requestType}] [段落: ${paragraphInfo}] [项目ID: ${projectId}] [版本: ${versionNumber}] API调用失败`);
      console.error(`├────────────────────────────────────────────────────────────────────`);
      console.error(`│ 错误类型: ${error.constructor.name}`);
      console.error(`│ 错误消息: ${error.message}`);
      
      if (error.response) {
        // 服务器返回了错误响应
        console.error(`│ 响应状态: ${error.response.status}`);
        console.error(`│ 响应头: ${JSON.stringify(error.response.headers)}`);
        console.error(`│ 响应内容: ${JSON.stringify(error.response.data)}`);
        errorMessage = `${this.getServiceName()}API服务器错误 (${error.response.status}): ${JSON.stringify(error.response.data)}`;
        rawResponse = JSON.stringify(error.response.data);
      } else if (error.request) {
        // 请求已发送但未收到响应
        console.error(`│ 请求已发送但未收到响应`);
        console.error(`│ 请求内容: ${JSON.stringify(error.request)}`);
        errorMessage = `无法连接到${this.getServiceName()}API服务器: ${error.message}`;
        rawResponse = JSON.stringify(error.request);
      } else {
        // 设置请求时发生错误
        console.error(`│ 请求设置错误`);
        errorMessage = `批改过程发生错误: ${error.message}`;
        rawResponse = JSON.stringify({ error: error.message });
      }
      
      console.error(`│ 耗时: ${duration.toFixed(2)}秒`);
      console.error(`└────────────────────────────────────────────────────────────────────`);
      
      // 使用默认的token使用情况对象，而不是累加的tokenUsageStats
      const defaultTokens = {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0
      };
      
      // 记录失败的请求日志
      await this.logPromptRequest(
        requestId,
        requestType,
        paragraphInfo,
        projectId !== '未指定' ? parseInt(projectId) : undefined,
        versionNumber !== '未指定' ? parseInt(versionNumber) : undefined,
        JSON.stringify(chatMessages),
        rawResponse,
        responseContent,
        defaultTokens,
        endTime - startTime,
        status,
        errorMessage
      );
      
      // 向上传递错误
      throw error;
    }
  }
  
  /**
   * 处理原始的AI响应为统一格式
   * @param content AI原始响应
   * @returns 规范化的批改结果
   */
  protected processResponse(content: string): IELTSFeedbackResult {
    try {
      // 解析响应内容
      let jsonData;
      let jsonParseSuccess = true;
      let errorDetails = '';
      
      try {
        jsonData = JSON.parse(content);
      } catch (e: any) {
        jsonParseSuccess = false;
        errorDetails = e.toString();
        
        // 尝试从文本中提取JSON
        jsonData = this.tryParseJson(content);
        if (jsonData) {
          jsonParseSuccess = true;
        } else {
          errorDetails = `无法解析JSON响应: ${e.message}`;
          throw new ApiError(`无法解析AI响应: ${e.message}`, 'JSON_PARSE_ERROR');
        }
      }
      
      console.log(`[${this.getServiceName()}] 解析AI响应${jsonParseSuccess ? '成功' : '失败'}`);
      
      // 提取分数
      let scoreTR = 0;
      let scoreCC = 0;
      let scoreLR = 0;
      let scoreGRA = 0;
      let annotations: Annotation[] = [];
      
      // 解析分数信息
      const normalizeScore = (score: any): number => {
        if (typeof score === 'number') return score;
        if (typeof score === 'string') {
          // 尝试从字符串中提取分数
          const scoreMatch = score.match(/(\d+(\.\d+)?)/);
          if (scoreMatch) {
            return parseFloat(scoreMatch[1]);
          }
        }
        return 0;
      };
      
      // 处理分数
      if (jsonData) {
        scoreTR = normalizeScore(jsonData.scoreTR);
        scoreCC = normalizeScore(jsonData.scoreCC);
        scoreLR = normalizeScore(jsonData.scoreLR);
        scoreGRA = normalizeScore(jsonData.scoreGRA);
        
        // 处理批注
        if (jsonData.annotations && Array.isArray(jsonData.annotations)) {
          annotations = jsonData.annotations;
        }
      }
      
      // 计算总分
      const overallScore = this.calculateOverallScore([scoreTR, scoreCC, scoreLR, scoreGRA]);
      
      // 标准化结果
      const result = {
        scoreTR,
        scoreCC,
        scoreLR,
        scoreGRA,
        feedbackTR: jsonData.feedbackTR || '无评价',
        feedbackCC: jsonData.feedbackCC || '无评价',
        feedbackLR: jsonData.feedbackLR || '无评价',
        feedbackGRA: jsonData.feedbackGRA || '无评价',
        overallFeedback: jsonData.overallFeedback || '无总体评价',
        annotations,
        tokenUsage: this.tokenUsageStats
      };
      
      console.log(`[${this.getServiceName()}] 处理响应完成, 评分: TR=${result.scoreTR}, CC=${result.scoreCC}, LR=${result.scoreLR}, GRA=${result.scoreGRA}`);
      
      return result;
    } catch (error) {
      console.error('处理响应内容失败:', error);
      throw new ApiError(`处理响应内容失败: ${error}`, 'RESPONSE_PROCESSING_ERROR');
    }
  }
  
  /**
   * 计算总体评分
   * @param scores 各项评分
   * @returns 总体评分
   */
  private calculateOverallScore(scores: number[]): number {
    const validScores = scores.filter(score => !isNaN(score) && score > 0);
    if (validScores.length === 0) return 0;
    
    const sum = validScores.reduce((total, score) => total + score, 0);
    return parseFloat((sum / validScores.length).toFixed(2));
  }
  
  /**
   * 重置token使用统计
   */
  private resetTokenUsage(): void {
    this.tokenUsageStats = {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0
    };
  }
  
  /**
   * 添加token使用统计
   * @param promptTokens 提示词tokens
   * @param completionTokens 回复tokens
   */
  private addTokenUsage(promptTokens: number, completionTokens: number): void {
    this.tokenUsageStats.promptTokens += promptTokens;
    this.tokenUsageStats.completionTokens += completionTokens;
    this.tokenUsageStats.totalTokens += promptTokens + completionTokens;
  }
  
  /**
   * 获取评分和反馈
   * @param request 批改请求
   */
  async getFeedback(request: IELTSFeedbackRequest): Promise<IELTSFeedbackResult> {
    // 直接调用基类方法
    return super.getFeedback(request);
  }
  
  /**
   * 获取段落批注
   * @param content 段落内容
   * @param context 上下文信息
   */
  async getAnnotation(content: string, context?: {
    paragraphIndex: number;
    allParagraphs: string[];
    feedback?: string;
    targetScore?: string;
    essayType?: string;
    projectId?: string;
    versionNumber?: string;
  }): Promise<Annotation[]> {
    try {
      // 获取项目ID和版本号
      const projectId = context?.projectId || '未指定';
      const versionNumber = context?.versionNumber || '未指定';
      const paragraphIndex = context?.paragraphIndex || 0;
      const totalParagraphs = context?.allParagraphs?.length || 1;
      
      // 创建段落信息字符串 "当前段落/总段落数"
      const paragraphInfo = `${paragraphIndex + 1}/${totalParagraphs}`;
      
      console.log(`[${this.getServiceName()}] [项目ID: ${projectId}] [版本: ${versionNumber}] 处理段落批注 ${paragraphInfo}`);
      
      // 确定任务类型
      let taskType = EssayTaskType.GENERAL;
      if (context?.essayType) {
        const essayType = context.essayType;
        if (essayType.includes('Task 1') || essayType.includes('Writing1')) {
          taskType = EssayTaskType.IELTS_TASK1;
        } else if (essayType.includes('Task 2') || essayType.includes('Writing2')) {
          taskType = EssayTaskType.IELTS_TASK2;
        } else if (this.examType.toLowerCase() === 'toefl') {
          taskType = EssayTaskType.TOEFL;
        }
      }
      
      // 获取对应的提示词模板
      const promptConfig = await PromptManager.getPrompt(
        KimiFeedbackService.MODEL_NAME,
        this.examType.toLowerCase(),
        taskType,
        PromptType.ANNOTATION
      );
      
      // 创建提示词模板实例
      const template = new PromptTemplate(promptConfig);
      
      // 构建模板数据
      const templateData = {
        content: content,
        allParagraphs: context?.allParagraphs || [content],
        paragraphIndex: paragraphIndex,
        feedback: context?.feedback || '',
        targetScore: context?.targetScore || ''
      };
      
      // 渲染提示词
      const prompt = template.render(templateData);
      
      // 调用API
      const responseContent = await this.callKimiAPI(
        prompt.systemMessage,
        prompt.userMessage,
        this.config.model_name || KimiFeedbackService.DEFAULT_MODEL,
        projectId,
        versionNumber,
        'annotation',
        paragraphInfo
      );
      
      // 处理响应 - 尝试解析JSON
      try {
        // 首先尝试直接解析整个响应
        const jsonData = JSON.parse(responseContent);
        
        // 验证响应是否具有annotations数组
        if (Array.isArray(jsonData.annotations)) {
          console.log(`[${this.getServiceName()}] [项目ID: ${projectId}] [版本: ${versionNumber}] 段落批注完成 ${paragraphInfo}, 获取到${jsonData.annotations.length}条批注`);
          return jsonData.annotations;
        } else if (jsonData.result && Array.isArray(jsonData.result.annotations)) {
          // 有些模型可能会将结果包装在result对象中
          console.log(`[${this.getServiceName()}] [项目ID: ${projectId}] [版本: ${versionNumber}] 段落批注完成 ${paragraphInfo}, 获取到${jsonData.result.annotations.length}条批注`);
          return jsonData.result.annotations;
        } else if (Array.isArray(jsonData)) {
          // 直接返回了数组形式
          console.log(`[${this.getServiceName()}] [项目ID: ${projectId}] [版本: ${versionNumber}] 段落批注完成 ${paragraphInfo}, 获取到${jsonData.length}条批注`);
          return jsonData;
        } else {
          // 响应中没有annotations数组
          console.warn(`[${this.getServiceName()}] [项目ID: ${projectId}] [版本: ${versionNumber}] API响应中未找到可用的批注格式`);
          return [];
        }
      } catch (parseError) {
        // JSON解析失败，尝试从响应中提取JSON部分
        console.warn(`[${this.getServiceName()}] [项目ID: ${projectId}] [版本: ${versionNumber}] 解析API响应JSON失败`);
        
        // 尝试匹配JSON数组
        const arrayMatch = responseContent.match(/\[\s*\{.*\}\s*\]/s);
        if (arrayMatch) {
          try {
            const annotations = JSON.parse(arrayMatch[0]);
            if (Array.isArray(annotations)) {
              console.log(`[${this.getServiceName()}] [项目ID: ${projectId}] [版本: ${versionNumber}] 段落批注完成 ${paragraphInfo}, 从文本中提取到${annotations.length}条批注`);
              return annotations;
            }
          } catch (innerError) {
            console.warn(`[${this.getServiceName()}] [项目ID: ${projectId}] [版本: ${versionNumber}] 从文本中提取JSON数组失败`);
          }
        }
        
        // 如果所有尝试都失败，则返回空数组
        console.error(`[${this.getServiceName()}] [项目ID: ${projectId}] [版本: ${versionNumber}] 无法从响应中解析批注`);
        return [];
      }
    } catch (error: any) {
      console.error(`[${this.getServiceName()}] 获取段落批注失败:`, error.message);
      return [];
    }
  }
  
  /**
   * 清理和修复可能的JSON字符串
   * @param content 可能包含JSON的字符串
   * @returns 清理后的JSON字符串
   */
  private cleanJsonString(content: string): string {
    // 确保内容存在
    if (!content) return '';
    
    // 修剪空白
    let cleaned = content.trim();
    
    // 如果像是JSON对象的开始，尝试提取完整的JSON
    if (cleaned.startsWith('{')) {
      // 查找最后一个 }
      const lastBraceIndex = cleaned.lastIndexOf('}');
      if (lastBraceIndex > 0) {
        cleaned = cleaned.substring(0, lastBraceIndex + 1);
      }
    }
    
    // 移除不可见字符和控制字符，它们可能导致JSON解析失败
    cleaned = cleaned.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
    
    // 修复常见JSON格式错误
    // 例如，将单引号替换为双引号（但只替换不在双引号内的单引号）
    // 这是一个简化的方法，可能不能处理所有情况
    let inString = false;
    let result = '';
    for (let i = 0; i < cleaned.length; i++) {
      const char = cleaned[i];
      if (char === '"') {
        inString = !inString;
      }
      
      if (char === "'" && !inString) {
        result += '"';
      } else {
        result += char;
      }
    }
    
    return result;
  }
  
  /**
   * 尝试用多种方法解析JSON
   * @param content 可能包含JSON的字符串
   * @returns 解析后的JSON对象或null
   */
  private tryParseJson(content: string): any | null {
    if (!content) return null;
    
    // 首先尝试清理内容
    const cleaned = this.cleanJsonString(content);
    try {
      return JSON.parse(cleaned);
    } catch (e) {
      // 尝试从内容中提取JSON
      try {
        // 查找可能的JSON代码块
        const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```|(\{[\s\S]*?\})/);
        if (jsonMatch && (jsonMatch[1] || jsonMatch[0])) {
          const jsonStr = jsonMatch[1] || jsonMatch[0];
          return JSON.parse(jsonStr.replace(/```json|```/g, '').trim());
        }
      } catch (_) { /* 忽略错误 */ }
      
      // 尝试查找第一个{和最后一个}
      try {
        const startIndex = content.indexOf('{');
        const endIndex = content.lastIndexOf('}');
        if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
          const jsonSubstring = content.substring(startIndex, endIndex + 1);
          return JSON.parse(jsonSubstring);
        }
      } catch (_) { /* 忽略错误 */ }
    }
    
    return null;
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
    essayContent?: string;  // 添加学生原文参数
  }): Promise<ExampleEssayResult> {
    try {
      // 获取项目ID和版本号
      const projectId = context?.projectId?.toString() || '未指定';
      const versionNumber = context?.versionNumber?.toString() || '未指定';
      
      console.log(`[${this.getServiceName()}] [项目ID: ${projectId}] [版本: ${versionNumber}] 开始生成范文`);
      
      // 重置token使用统计
      this.resetTokenUsage();
      
      // 获取考试类型
      let examType = context?.examType || this.examType;
      console.log(`[${this.getServiceName()}] [项目ID: ${projectId}] [版本: ${versionNumber}] 考试类型: ${examType}`);
      
      // 获取任务类型
      let taskType = EssayTaskType.GENERAL;
      
      // 根据考试类型和考试类别确定任务类型
      if (examType.toLowerCase() === 'ielts') {
        if (context?.examCategory) {
          if (context.examCategory.includes('Task 1') || 
              context.examCategory.includes('task 1') || 
              context.examCategory.includes('Writing1') || 
              context.examCategory.includes('writing1')) {
            taskType = EssayTaskType.IELTS_TASK1;
            console.log(`[${this.getServiceName()}] [项目ID: ${projectId}] [版本: ${versionNumber}] 识别为IELTS Task 1`);
          } else if (context.examCategory.includes('Task 2') || 
                    context.examCategory.includes('task 2') || 
                    context.examCategory.includes('Writing2') || 
                    context.examCategory.includes('writing2')) {
            taskType = EssayTaskType.IELTS_TASK2;
            console.log(`[${this.getServiceName()}] [项目ID: ${projectId}] [版本: ${versionNumber}] 识别为IELTS Task 2`);
          } else {
            // 如果examCategory存在但无法判断是Task1还是Task2，则查找这个字符串中的任何线索
            const categoryLower = context.examCategory.toLowerCase();
            if (categoryLower.includes('1') || categoryLower.includes('图')) {
              taskType = EssayTaskType.IELTS_TASK1;
              console.log(`[${this.getServiceName()}] [项目ID: ${projectId}] [版本: ${versionNumber}] 根据类别内容判断为IELTS Task 1`);
            } else if (categoryLower.includes('2') || categoryLower.includes('议')) {
              taskType = EssayTaskType.IELTS_TASK2;
              console.log(`[${this.getServiceName()}] [项目ID: ${projectId}] [版本: ${versionNumber}] 根据类别内容判断为IELTS Task 2`);
            } else {
              // 实在无法判断，使用通用类型，但是后续会尝试加载具体类型文件
              console.log(`[${this.getServiceName()}] [项目ID: ${projectId}] [版本: ${versionNumber}] 无法确定具体IELTS任务类型，使用通用类型`);
            }
          }
        } else {
          // 没有提供examCategory，尝试从prompt内容判断
          if (prompt.toLowerCase().includes('chart') || 
              prompt.toLowerCase().includes('graph') || 
              prompt.toLowerCase().includes('diagram') || 
              prompt.toLowerCase().includes('map') ||
              prompt.toLowerCase().includes('图表') ||
              prompt.toLowerCase().includes('地图')) {
            taskType = EssayTaskType.IELTS_TASK1;
            console.log(`[${this.getServiceName()}] [项目ID: ${projectId}] [版本: ${versionNumber}] 根据题目内容判断为IELTS Task 1`);
          } else {
            // 默认为Task 2，但会根据需要重试
            taskType = EssayTaskType.IELTS_TASK2;
            console.log(`[${this.getServiceName()}] [项目ID: ${projectId}] [版本: ${versionNumber}] 根据题目内容判断为IELTS Task 2`);
          }
        }
      } else if (examType.toLowerCase() === 'toefl') {
        taskType = EssayTaskType.TOEFL;
        console.log(`[${this.getServiceName()}] [项目ID: ${projectId}] [版本: ${versionNumber}] 识别为托福作文`);
      } else if (examType.toLowerCase() === 'gre') {
        taskType = EssayTaskType.GRE;
        console.log(`[${this.getServiceName()}] [项目ID: ${projectId}] [版本: ${versionNumber}] 识别为GRE作文`);
      } else {
        // 其他类型的考试，保持通用类型，后续会尝试加载具体类型文件
        console.log(`[${this.getServiceName()}] [项目ID: ${projectId}] [版本: ${versionNumber}] 使用通用作文类型`);
      }
      
      // 使用配置中的模型名称
      const modelName = this.config.model_name || KimiFeedbackService.DEFAULT_MODEL;
      console.log(`[${this.getServiceName()}] [项目ID: ${projectId}] [版本: ${versionNumber}] 使用模型: ${modelName}`);
      
      try {
        // 尝试获取对应的提示词模板
        const promptConfig = await PromptManager.getPrompt(
          KimiFeedbackService.MODEL_NAME, // 这里只是用于模板查找
          examType.toLowerCase(),
          taskType,
          PromptType.EXAMPLE
        );
        
        // 创建提示词模板实例
        const template = new PromptTemplate(promptConfig);
        
        // 构建模板数据
        const templateData = {
          prompt: prompt,
          exam_type: context?.examType || this.examType,
          exam_category: context?.examCategory || taskType,
          targetScore: context?.targetScore || '6.0',
          content: context?.essayContent || '' // 添加学生原文
        };
        
        // 渲染提示词
        const renderedPrompt = template.render(templateData);
        console.log(`[${this.getServiceName()}] [项目ID: ${projectId}] [版本: ${versionNumber}] 使用提示词 | 模型: ${modelName} | 使用模板: ${KimiFeedbackService.MODEL_NAME} | 考试: ${examType} | 任务: ${taskType}`);
        
        // 调用API，指定请求类型为 example_essay
        console.log(`[${this.getServiceName()}] [项目ID: ${projectId}] [版本: ${versionNumber}] 正在调用API生成范文...`);
        const responseContent = await this.callKimiAPI(
          renderedPrompt.systemMessage, 
          renderedPrompt.userMessage, 
          modelName,
          projectId, 
          versionNumber,
          'example_essay',
          '1/1'
        );
        
        // 解析返回的JSON结果
        let exampleEssay = '';
        let improvement = '';
        
        try {
          // 解析响应内容提取范文和改进建议
          const jsonResult = this.parseExampleEssayResponse(responseContent);
          if (jsonResult.exampleEssay) {
            exampleEssay = jsonResult.exampleEssay;
          }
          if (jsonResult.improvement) {
            improvement = jsonResult.improvement;
          }
        } catch (parseError) {
          // 如果解析失败，则直接使用返回内容作为范文
          console.warn(`[${this.getServiceName()}] [项目ID: ${projectId}] [版本: ${versionNumber}] 解析JSON失败，使用原始响应作为范文`);
          exampleEssay = responseContent;
        }
        
        // 计算字数
        const wordCount = this.countWords(exampleEssay);
        
        // 构建返回结果
        const result = {
          exampleContent: exampleEssay,
          improvement: improvement, // 添加改进建议
          wordCount: wordCount,
          tokenUsage: {
            promptTokens: this.tokenUsageStats.promptTokens,
            completionTokens: this.tokenUsageStats.completionTokens,
            totalTokens: this.tokenUsageStats.totalTokens
          }
        };
        
        console.log(`[${this.getServiceName()}] [项目ID: ${projectId}] [版本: ${versionNumber}] 范文生成完成 | Token: ${result.tokenUsage?.totalTokens || 0} | 字数: ${wordCount}`);
        return result;
      } catch (promptError: any) {
        // 如果加载模板失败，尝试使用不同的任务类型
        console.warn(`[${this.getServiceName()}] [项目ID: ${projectId}] [版本: ${versionNumber}] 加载提示词模板失败: ${promptError.message}`);
        
        // 如果是雅思考试，当前使用了Task1但失败，尝试Task2，反之亦然
        if (examType.toLowerCase() === 'ielts') {
          if (taskType === EssayTaskType.IELTS_TASK1) {
            console.log(`[${this.getServiceName()}] [项目ID: ${projectId}] [版本: ${versionNumber}] 尝试使用IELTS Task 2模板`);
            taskType = EssayTaskType.IELTS_TASK2;
          } else if (taskType === EssayTaskType.IELTS_TASK2) {
            console.log(`[${this.getServiceName()}] [项目ID: ${projectId}] [版本: ${versionNumber}] 尝试使用IELTS Task 1模板`);
            taskType = EssayTaskType.IELTS_TASK1;
          }
          
          try {
            // 再次尝试加载模板
            const promptConfig = await PromptManager.getPrompt(
              KimiFeedbackService.MODEL_NAME,
              examType.toLowerCase(),
              taskType,
              PromptType.EXAMPLE
            );
            
            // 创建提示词模板实例
            const template = new PromptTemplate(promptConfig);
            
            // 构建模板数据
            const templateData = {
              prompt: prompt,
              exam_type: context?.examType || this.examType,
              exam_category: context?.examCategory || taskType,
              targetScore: context?.targetScore || '6.0',
              content: context?.essayContent || '' // 添加学生原文
            };
            
            // 渲染提示词
            const renderedPrompt = template.render(templateData);
            console.log(`[${this.getServiceName()}] [项目ID: ${projectId}] [版本: ${versionNumber}] 使用备选提示词 | 模型: ${modelName} | 使用模板: ${KimiFeedbackService.MODEL_NAME} | 考试: ${examType} | 任务: ${taskType}`);
            
            // 调用API，指定请求类型为 example_essay
            console.log(`[${this.getServiceName()}] [项目ID: ${projectId}] [版本: ${versionNumber}] 正在使用备选模板调用API生成范文...`);
            const responseContent = await this.callKimiAPI(
              renderedPrompt.systemMessage, 
              renderedPrompt.userMessage, 
              modelName,
              projectId, 
              versionNumber,
              'example_essay',
              '1/1'
            );
            
            // 解析返回的JSON结果
            let exampleEssay = '';
            let improvement = '';
            
            try {
              // 解析响应内容提取范文和改进建议
              const jsonResult = this.parseExampleEssayResponse(responseContent);
              if (jsonResult.exampleEssay) {
                exampleEssay = jsonResult.exampleEssay;
              }
              if (jsonResult.improvement) {
                improvement = jsonResult.improvement;
              }
            } catch (parseError) {
              // 如果解析失败，则直接使用返回内容作为范文
              console.warn(`[${this.getServiceName()}] [项目ID: ${projectId}] [版本: ${versionNumber}] 解析JSON失败，使用原始响应作为范文`);
              exampleEssay = responseContent;
            }
            
            // 计算字数
            const wordCount = this.countWords(exampleEssay);
            
            // 构建返回结果
            const result = {
              exampleContent: exampleEssay,
              improvement: improvement, // 添加改进建议
              wordCount: wordCount,
              tokenUsage: {
                promptTokens: this.tokenUsageStats.promptTokens,
                completionTokens: this.tokenUsageStats.completionTokens,
                totalTokens: this.tokenUsageStats.totalTokens
              }
            };
            
            console.log(`[${this.getServiceName()}] [项目ID: ${projectId}] [版本: ${versionNumber}] 备选模板范文生成完成 | Token: ${result.tokenUsage?.totalTokens || 0} | 字数: ${wordCount}`);
            return result;
          } catch (retryError: any) {
            // 如果备选模板也失败，则抛出原始错误
            console.error(`[${this.getServiceName()}] [项目ID: ${projectId}] [版本: ${versionNumber}] 备选模板也加载失败: ${retryError.message}`);
            throw promptError;
          }
        }
        
        // 对于非IELTS考试或者备选方案也失败的情况，使用通用提示词
        console.log(`[${this.getServiceName()}] [项目ID: ${projectId}] [版本: ${versionNumber}] 使用通用提示词模板`);
        
        // 简单的通用提示词
        const systemMessage = `你是一位专业的${examType}考试作文老师，请根据以下题目和要求，生成一篇目标分数为${context?.targetScore || '高分'}的范文。请确保文章结构清晰，论点有力，表达流畅，并符合评分标准。`;
        const userMessage = `请根据以下题目写一篇${examType}范文，目标分数为${context?.targetScore || '高分'}：\n\n${prompt}\n\n请使用JSON格式返回，包含exampleEssay(范文内容)和improvement(针对学生的改进建议)字段。`;
        
        // 调用API
        const responseContent = await this.callKimiAPI(
          systemMessage, 
          userMessage, 
          modelName,
          projectId, 
          versionNumber,
          'example_essay',
          '1/1'
        );
        
        // 尝试解析响应
        let exampleEssay = '';
        let improvement = '';
        
        try {
          const jsonResult = this.parseExampleEssayResponse(responseContent);
          exampleEssay = jsonResult.exampleEssay;
          improvement = jsonResult.improvement;
        } catch (parseError) {
          exampleEssay = responseContent;
        }
        
        // 计算字数
        const wordCount = this.countWords(exampleEssay);
        
        // 构建结果
        const result = {
          exampleContent: exampleEssay,
          improvement: improvement,
          wordCount: wordCount,
          tokenUsage: {
            promptTokens: this.tokenUsageStats.promptTokens,
            completionTokens: this.tokenUsageStats.completionTokens,
            totalTokens: this.tokenUsageStats.totalTokens
          }
        };
        
        console.log(`[${this.getServiceName()}] [项目ID: ${projectId}] [版本: ${versionNumber}] 通用提示词范文生成完成 | Token: ${result.tokenUsage?.totalTokens || 0} | 字数: ${wordCount}`);
        return result;
      }
    } catch (error: any) {
      const projectId = context?.projectId?.toString() || '未指定';
      const versionNumber = context?.versionNumber?.toString() || '未指定';
      console.error(`[${this.getServiceName()}] [项目ID: ${projectId}] [版本: ${versionNumber}] 范文生成失败 | 错误: ${error.message}`);
      
      if (error instanceof ApiError) {
        throw error;
      }
      
      if (error.response) {
        // 服务器错误
        const status = error.response.status;
        const errorData = error.response.data;
        throw new ApiError(
          `${this.getServiceName()}API服务器错误 (${status}): ${JSON.stringify(errorData)}`, 
          'KIMI_API_ERROR'
        );
      } else if (error.request) {
        // 请求错误
        throw new ApiError(`无法连接到${this.getServiceName()}API服务器`, 'CONNECTION_ERROR');
      } else {
        // 其他错误
        throw new ApiError(`范文生成过程发生错误: ${error.message}`, 'PROCESSING_ERROR');
      }
    }
  }

  /**
   * 解析范文生成的响应JSON
   * @param content API返回的内容
   * @returns 提取的exampleEssay和improvement
   */
  private parseExampleEssayResponse(content: string): {exampleEssay: string, improvement: string} {
    // 默认结果
    let result = {
      exampleEssay: '',
      improvement: ''
    };
    
    // 清理内容，移除非JSON字符
    let cleanedContent = content.trim();
    
    // 如果内容被markdown代码块包围，尝试提取JSON部分
    const codeBlockMatch = cleanedContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch && codeBlockMatch[1]) {
      cleanedContent = codeBlockMatch[1].trim();
    }
    
    try {
      // 首先尝试标准的JSON解析
      const parsed = JSON.parse(cleanedContent);
      
      // 检查是否存在exampleEssay字段
      if (typeof parsed.exampleEssay === 'string') {
        result.exampleEssay = parsed.exampleEssay;
      }
      
      // 检查是否存在improvement字段
      if (typeof parsed.improvement === 'string') {
        result.improvement = parsed.improvement;
      }
      
      // 如果没有找到exampleEssay字段，尝试查找其他可能的字段名
      if (!result.exampleEssay) {
        const possibleEssayFields = ['essay', 'content', 'example', 'sampleEssay', 'text', 'result'];
        for (const field of possibleEssayFields) {
          if (typeof parsed[field] === 'string' && parsed[field].length > 100) {
            result.exampleEssay = parsed[field];
            break;
          }
        }
      }
      
      return result;
    } catch (jsonError) {
      // JSON解析失败，尝试使用正则表达式提取内容
      try {
        // 提取exampleEssay字段
        const essayRegex = /"exampleEssay"\s*:\s*"((?:[^"\\]|\\.)*)"/;
        const essayMatch = cleanedContent.match(essayRegex);
        if (essayMatch && essayMatch[1]) {
          result.exampleEssay = essayMatch[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
        }
        
        // 提取improvement字段
        const improvementRegex = /"improvement"\s*:\s*"((?:[^"\\]|\\.)*)"/;
        const improvementMatch = cleanedContent.match(improvementRegex);
        if (improvementMatch && improvementMatch[1]) {
          result.improvement = improvementMatch[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
        }
        
        // 如果正则表达式提取失败，尝试更复杂的方法
        if (!result.exampleEssay) {
          // 查找第一个大括号和最后一个大括号，提取整个JSON对象
          const firstBrace = cleanedContent.indexOf('{');
          const lastBrace = cleanedContent.lastIndexOf('}');
          
          if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
            const jsonSubstring = cleanedContent.substring(firstBrace, lastBrace + 1);
            
            try {
              const parsedSubstring = JSON.parse(jsonSubstring);
              if (parsedSubstring.exampleEssay) {
                result.exampleEssay = parsedSubstring.exampleEssay;
              }
              if (parsedSubstring.improvement) {
                result.improvement = parsedSubstring.improvement;
              }
            } catch (e) {
              // 忽略这个错误，继续尝试其他方法
            }
          }
        }
        
        // 如果依然没有找到，检查内容是否包含大量文本，如果是，则可能整个内容就是范文
        if (!result.exampleEssay && cleanedContent.length > 200) {
          // 检查内容是否具有文章特征（例如，多个段落，包含常见单词等）
          const hasMultipleParagraphs = (cleanedContent.split('\n\n').length > 1);
          const hasCommonWords = /\b(the|and|in|to|of|a|that|for|is|are|with|as|on|this|by)\b/i.test(cleanedContent);
          
          if (hasMultipleParagraphs || hasCommonWords) {
            result.exampleEssay = cleanedContent;
          }
        }
      } catch (regexError) {
        console.error(`正则解析失败: ${regexError}`);
      }
      
      // 如果所有方法都失败，将原始内容作为范文
      if (!result.exampleEssay) {
        result.exampleEssay = content;
      }
      
      return result;
    }
  }

  /**
   * 计算文本中的单词数量
   * @param text 文本内容
   * @returns 单词数量
   */
  private countWords(text: string): number {
    // 对于英文文本，按照空格分隔计算单词数
    // 对于中文文本，每个汉字算一个单词
    if (!text) return 0;
    
    // 先移除多余的空格和特殊字符
    const cleanedText = text.replace(/\s+/g, ' ').trim();
    
    // 判断是否主要为英文
    const isMainlyEnglish = /[a-zA-Z]/.test(cleanedText) && cleanedText.match(/[a-zA-Z]/g)!.length > cleanedText.length / 3;
    
    if (isMainlyEnglish) {
      // 英文单词计数
      return cleanedText.split(/\s+/).length;
    } else {
      // 中文字符计数 (每个汉字算一个"词")
      return [...cleanedText].filter(char => /[\u4e00-\u9fa5]/.test(char)).length;
    }
  }
}