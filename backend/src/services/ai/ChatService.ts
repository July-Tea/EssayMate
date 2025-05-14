import { ApiError } from '../../middleware/errorHandler';
import { BaseService } from '../base';
import { AIConfig } from '../../types/api';
import { ConfigService } from '../config/ConfigService';
import { PromptManager, PromptType } from './prompts/PromptManager';
import { PromptTemplate } from './prompts/PromptTemplate';
import { PromptLogModel } from '../../models/PromptLog';
import { v4 as uuidv4 } from 'uuid';
import { ChatMessageModel } from '../../models/ChatMessage';
import axios from 'axios';

// 定义请求超时时间
const REQUEST_TIMEOUT = 60000;

/**
 * AI对话响应接口
 */
export interface ChatResponse {
  content: string;
  messageId: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * 流式响应接口
 */
export interface StreamResponse {
  messageId: string;
  res: any;  // Express Response对象
}

/**
 * AI对话服务类
 * 负责处理用户与AI的对话交互
 */
export class ChatService extends BaseService {
  private config: AIConfig;
  private configService: ConfigService;
  private promptLogModel: PromptLogModel;
  private chatMessageModel: ChatMessageModel;
  
  // 不同模型的API URL
  private static readonly API_URLS: Record<string, string> = {
    doubao: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions', // 豆包API
    kimi: 'https://api.moonshot.cn/v1/chat/completions', // Kimi API
    tongyi: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation' // 通义千问API
  };

  constructor(config?: AIConfig) {
    super();
    this.configService = new ConfigService();
    this.promptLogModel = new PromptLogModel();
    this.chatMessageModel = new ChatMessageModel();
    this.config = config || {} as AIConfig;
  }

  /**
   * 获取当前活动的AI配置
   */
  async getActiveConfig(): Promise<AIConfig> {
    try {
      // 如果已有配置则使用已有配置
      if (this.config.model && this.config.apiKey) {
        return this.config;
      }
      
      // 否则从数据库获取活动配置
      const activeConfig = await this.configService.getActiveConfig();
      if (!activeConfig) {
        throw new ApiError('未找到活动配置', 'NO_ACTIVE_CONFIG', 404);
      }

      // 从modelConfigs中获取model_name（如果存在）
      const model_name = activeConfig.modelConfigs?.model_name || null;

      this.config = {
        model: activeConfig.model,
        apiKey: activeConfig.apiKey,
        model_name: model_name,
        modelConfigs: activeConfig.modelConfigs
      };

      return this.config;
    } catch (error: any) {
      console.error('获取活动配置失败:', error);
      throw new ApiError(error.message || '获取活动配置失败', 'CONFIG_FETCH_ERROR', 500);
    }
  }

  /**
   * 获取聊天历史
   * @param projectId 项目ID
   * @param versionNumber 版本号
   * @param sessionId 会话ID
   */
  async getChatHistory(projectId: number, versionNumber: number, sessionId?: string): Promise<any[]> {
    try {
      const messages = await this.chatMessageModel.getByProjectAndVersion({
        projectId,
        versionNumber,
        sessionId
      });
      
      return messages;
    } catch (error: any) {
      console.error('获取聊天历史失败:', error);
      throw new ApiError(error.message || '获取聊天历史失败', 'CHAT_HISTORY_ERROR', 500);
    }
  }

  /**
   * 创建新的聊天会话
   * @param projectId 项目ID
   * @param versionNumber 版本号
   */
  async createChatSession(projectId: number, versionNumber: number): Promise<string> {
    const sessionId = uuidv4();
    
    // 创建一条系统欢迎消息
    // await this.chatMessageModel.create({
    //   projectId,
    //   versionNumber,
    //   sessionId,
    //   messageId: uuidv4(),
    //   role: 'system',
    //   content: '你好！我是你的写作助手，你想了解些什么？可以向我提问关于如何提高作文分数的问题，我会尽力帮助你！',
    //   status: 'sent'
    // });
    
    return sessionId;
  }

  /**
   * 发送聊天消息并获取AI回复
   * @param projectId 项目ID
   * @param versionNumber 版本号
   * @param sessionId 会话ID
   * @param message 用户消息
   * @param parentId 父消息ID（用于分支对话）
   * @param examType 考试类型
   * @param taskType 任务类型
   * @param title 文章标题
   * @param content 文章内容
   */
  async sendMessage(
    projectId: number,
    versionNumber: number,
    sessionId: string,
    message: string,
    parentId?: string,
    examType: string = 'ielts',
    taskType: string = 'task1',
    title: string = '',
    content: string = ''
  ): Promise<ChatResponse> {
    try {
      const config = await this.getActiveConfig();
      
      // 生成消息ID
      const userMessageId = uuidv4();
      
      // 保存用户消息
      await this.chatMessageModel.create({
        projectId,
        versionNumber,
        sessionId,
        parentId,
        messageId: userMessageId,
        role: 'user',
        content: message,
        status: 'sent'
      });
      
      // 生成AI回复ID
      const aiMessageId = uuidv4();
      
      // 先创建一条待处理的AI回复消息
      await this.chatMessageModel.create({
        projectId,
        versionNumber,
        sessionId,
        parentId: userMessageId,
        messageId: aiMessageId,
        role: 'assistant',
        content: '',
        status: 'sending'
      });
      
      // 获取相应的提示词模板
      const promptType = PromptType.CHAT;
      const promptConfig = await PromptManager.getPrompt(
        config.model,
        examType,
        taskType,
        promptType
      );
      
      // 创建提示词模板引擎
      const promptTemplate = new PromptTemplate(promptConfig);
      
      // 渲染提示词
      const { systemMessage, userMessage } = promptTemplate.render({
        message: message,
        title: title,
        content: content
      });
      
      // 记录请求开始时间
      const startTime = Date.now();
      
      // 准备发送到AI服务的请求体
      const requestId = uuidv4();
      
      try {
        // 发送请求到AI服务
        console.log(`发送请求到 ${config.model} API, 模型: ${config.model_name || '默认模型'}`);
        const aiResponse = await this.sendToAIService(config, systemMessage, userMessage);
        
        // 计算请求耗时
        const duration = Date.now() - startTime;
        
        // 提取AI响应内容
        const responseContent = aiResponse.content;
        
        // 提取token使用情况
        const tokenUsage = aiResponse.usage || {
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0
        };
        
        // 更新AI回复消息
        await this.chatMessageModel.update(aiMessageId, {
          content: responseContent,
          status: 'sent'
        });
        
        // 记录提示词日志
        await this.promptLogModel.create({
          serviceType: config.model,
          modelName: config.model_name || this.getDefaultModelName(config.model),
          requestId: requestId,
          requestType: 'chat',
          paragraphInfo: 'IELTS Chat',
          projectId: projectId,
          versionNumber: versionNumber,
          promptContent: JSON.stringify({
            system: systemMessage,
            user: userMessage
          }),
          rawResponse: JSON.stringify(aiResponse.rawResponse || {}),
          responseContent: responseContent,
          tokenUsage: tokenUsage.totalTokens,
          tokenUsageDetail: tokenUsage,
          duration: duration,
          status: 'success'
        });
        
        return {
          content: responseContent,
          messageId: aiMessageId,
          usage: tokenUsage
        };
      } catch (error: any) {
        console.error('AI服务请求失败:', error);
        
        // 更新AI回复消息为错误状态
        await this.chatMessageModel.update(aiMessageId, {
          content: '抱歉，处理您的请求时出现了问题，请稍后重试。',
          status: 'error',
          errorMessage: error.message || '未知错误'
        });
        
        // 记录错误日志
        await this.promptLogModel.create({
          serviceType: config.model,
          modelName: config.model_name || this.getDefaultModelName(config.model),
          requestId: requestId,
          requestType: 'chat',
          paragraphInfo: 'IELTS Chat',
          projectId: projectId,
          versionNumber: versionNumber,
          promptContent: JSON.stringify({
            system: systemMessage,
            user: userMessage
          }),
          rawResponse: JSON.stringify(error.response?.data || error.message || ''),
          responseContent: error.message || '未知错误',
          tokenUsage: 0,
          tokenUsageDetail: {
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0
          },
          duration: Date.now() - startTime,
          status: 'error',
          errorMessage: error.message || '未知错误'
        });
        
        throw new ApiError('AI服务请求失败: ' + (error.message || '未知错误'), 'AI_SERVICE_ERROR', 500);
      }
    } catch (error: any) {
      console.error('发送聊天消息失败:', error);
      throw new ApiError(error.message || '发送聊天消息失败', 'CHAT_ERROR', 500);
    }
  }
  
  /**
   * 根据消息ID删除消息及其子消息
   * @param messageId 消息ID
   */
  async deleteMessage(messageId: string): Promise<void> {
    try {
      // 获取子消息
      const childMessages = await this.chatMessageModel.getChildMessages(messageId);
      
      // 递归删除子消息
      for (const child of childMessages) {
        await this.deleteMessage(child.message_id);
      }
      
      // 删除当前消息
      await this.chatMessageModel.deleteByMessageId(messageId);
    } catch (error: any) {
      console.error('删除消息失败:', error);
      throw new ApiError(error.message || '删除消息失败', 'DELETE_MESSAGE_ERROR', 500);
    }
  }
  
  /**
   * 删除整个会话
   * @param sessionId 会话ID
   */
  async deleteSession(sessionId: string): Promise<void> {
    try {
      await this.chatMessageModel.deleteBySessionId(sessionId);
    } catch (error: any) {
      console.error('删除会话失败:', error);
      throw new ApiError(error.message || '删除会话失败', 'DELETE_SESSION_ERROR', 500);
    }
  }

  /**
   * 发送请求到AI服务
   * @param config AI配置
   * @param systemMessage 系统消息
   * @param userMessage 用户消息
   */
  private async sendToAIService(
    config: AIConfig, 
    systemMessage: string, 
    userMessage: string
  ): Promise<{
    content: string;
    rawResponse: any;
    usage: { promptTokens: number; completionTokens: number; totalTokens: number; }
  }> {
    const modelType = config.model.toLowerCase();
    const modelName = config.model_name || this.getDefaultModelName(modelType);
    
    let url = ChatService.API_URLS[modelType] || ChatService.API_URLS.doubao;
    
    let headers: any = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`
    };
    
    let requestBody: any = {};
    
    if (modelType === 'doubao') {
      // 豆包API请求体
      requestBody = {
        model: modelName,
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.5,
        max_tokens: 1000,
        top_p: 0.95,
        top_k: 40
      };
    } else if (modelType === 'kimi') {
      // Kimi API请求体
      requestBody = {
        model: modelName,
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.7,
        max_tokens: 1000
      };
    } else if (modelType === 'tongyi') {
      // 通义千问API请求体
      requestBody = {
        model: modelName,
        input: {
          messages: [
            { role: 'system', content: systemMessage },
            { role: 'user', content: userMessage }
          ]
        },
        parameters: {
          temperature: 0.7,
          max_tokens: 1000
        }
      };
    } else {
      // 默认使用豆包格式
      requestBody = {
        model: modelName,
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.7,
        max_tokens: 1000
      };
    }
    
    try {
      console.log(`发送请求到${modelType}API: ${url}, 使用模型: ${modelName}`);
      
      const response = await axios({
        method: 'post',
        url: url,
        headers: headers,
        data: requestBody,
        timeout: REQUEST_TIMEOUT
      });
      
      const responseData = response.data;
      
      // 提取响应内容和token使用情况
      let content = '';
      let tokenUsage = {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0
      };
      
      if (modelType === 'doubao') {
        // 豆包API响应结构
        content = responseData.choices?.[0]?.message?.content || '';
        tokenUsage = {
          promptTokens: responseData.usage?.prompt_tokens || 0,
          completionTokens: responseData.usage?.completion_tokens || 0,
          totalTokens: responseData.usage?.total_tokens || 0
        };
      } else if (modelType === 'kimi') {
        // Kimi API响应结构
        content = responseData.choices?.[0]?.message?.content || '';
        tokenUsage = {
          promptTokens: responseData.usage?.prompt_tokens || 0,
          completionTokens: responseData.usage?.completion_tokens || 0,
          totalTokens: responseData.usage?.total_tokens || 0
        };
      } else if (modelType === 'tongyi') {
        // 通义千问API响应结构
        content = responseData.output?.text || '';
        tokenUsage = {
          promptTokens: responseData.usage?.input_tokens || 0,
          completionTokens: responseData.usage?.output_tokens || 0,
          totalTokens: (responseData.usage?.input_tokens || 0) + (responseData.usage?.output_tokens || 0)
        };
      } else {
        // 尝试通用提取
        if (responseData.choices && responseData.choices[0]) {
          if (responseData.choices[0].message) {
            content = responseData.choices[0].message.content || '';
          } else if (responseData.choices[0].text) {
            content = responseData.choices[0].text || '';
          }
        } else if (responseData.output) {
          content = responseData.output.text || '';
        }
      }
      
      return {
        content,
        rawResponse: responseData,
        usage: tokenUsage
      };
    } catch (error: any) {
      console.error(`发送请求到 ${modelType} API失败:`, error);
      
      if (error.response) {
        throw new Error(`API错误: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
      } else if (error.request) {
        throw new Error('未收到API响应，请检查网络连接');
      } else {
        throw new Error(`请求错误: ${error.message}`);
      }
    }
  }
  
  /**
   * 获取默认模型名称
   * @param modelType 模型类型
   */
  private getDefaultModelName(modelType: string): string {
    switch (modelType.toLowerCase()) {
      case 'doubao':
        return 'doubao-turbo';
      case 'kimi':
        return 'moonshot-v1-8k';
      case 'tongyi':
        return 'qwen-max';
      default:
        return 'doubao-turbo';
    }
  }

  /**
   * 流式发送聊天消息并获取AI回复
   * @param projectId 项目ID
   * @param versionNumber 版本号
   * @param sessionId 会话ID
   * @param message 用户消息
   * @param res Express Response对象
   * @param parentId 父消息ID（用于分支对话）
   * @param examType 考试类型
   * @param taskType 任务类型
   * @param title 文章标题
   * @param content 文章内容
   */
  async sendMessageStream(
    projectId: number,
    versionNumber: number,
    sessionId: string,
    message: string,
    res: any,
    parentId?: string,
    examType: string = 'ielts',
    taskType: string = 'task1',
    title: string = '',
    content: string = ''
  ): Promise<StreamResponse> {
    try {
      const config = await this.getActiveConfig();
      
      // 生成消息ID
      const userMessageId = uuidv4();
      
      // 保存用户消息
      await this.chatMessageModel.create({
        projectId,
        versionNumber,
        sessionId,
        parentId,
        messageId: userMessageId,
        role: 'user',
        content: message,
        status: 'sent'
      });
      
      // 生成AI回复ID
      const aiMessageId = uuidv4();
      
      // 先创建一条待处理的AI回复消息
      await this.chatMessageModel.create({
        projectId,
        versionNumber,
        sessionId,
        parentId: userMessageId,
        messageId: aiMessageId,
        role: 'assistant',
        content: '',
        status: 'sending'
      });
      
      // 获取相应的提示词模板
      const promptType = PromptType.CHAT;
      const promptConfig = await PromptManager.getPrompt(
        config.model,
        examType,
        taskType,
        promptType
      );
      
      // 创建提示词模板引擎
      const promptTemplate = new PromptTemplate(promptConfig);
      
      // 渲染提示词
      const { systemMessage, userMessage } = promptTemplate.render({
        message: message,
        title: title,
        content: content
      });
      
      // 记录请求开始时间
      const startTime = Date.now();
      
      // 准备发送到AI服务的请求体
      const requestId = uuidv4();
      
      try {
        // 发送请求到AI服务，使用流式响应
        console.log(`发送流式请求到 ${config.model} API, 模型: ${config.model_name || '默认模型'}`);
        
        // 为SSE设置响应头
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();
        
        // 给前端发送消息ID和请求ID，用于关联后续的流式内容和更新日志
        res.write(`data: ${JSON.stringify({ messageId: aiMessageId, requestId: requestId, type: 'init' })}\n\n`);
        
        // 调用流式请求
        await this.sendToAIServiceStream(config, systemMessage, userMessage, res, aiMessageId);
        
        // 计算请求耗时
        const duration = Date.now() - startTime;
        
        // 更新AI回复消息状态为已发送
        await this.chatMessageModel.update(aiMessageId, {
          status: 'sent'
        });
        
        // 模拟token使用情况（实际值将在流式结束后由前端传回）
        const tokenUsage = {
          promptTokens: systemMessage.length / 4 + userMessage.length / 4,
          completionTokens: 0, // 由前端更新
          totalTokens: systemMessage.length / 4 + userMessage.length / 4
        };
        
        // 记录提示词日志，但内容会在后续由前端更新
        await this.promptLogModel.create({
          serviceType: config.model,
          modelName: config.model_name || this.getDefaultModelName(config.model),
          requestId: requestId,
          requestType: 'chat',
          paragraphInfo: 'IELTS Chat',
          projectId: projectId,
          versionNumber: versionNumber,
          promptContent: JSON.stringify({
            system: systemMessage,
            user: userMessage
          }),
          rawResponse: JSON.stringify({ note: '流式响应，完整数据将在流结束后更新' }),
          responseContent: '流式响应内容，将在流结束后更新',
          tokenUsage: tokenUsage.totalTokens,
          tokenUsageDetail: tokenUsage,
          duration: duration,
          status: 'success'
        });
        
        // 结束请求
        res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
        
        return {
          messageId: aiMessageId,
          res
        };
      } catch (error: any) {
        console.error('AI服务流式请求失败:', error);
        
        // 向客户端发送错误信息
        res.write(`data: ${JSON.stringify({ type: 'error', error: error.message || '未知错误' })}\n\n`);
        
        // 更新AI回复消息为错误状态
        await this.chatMessageModel.update(aiMessageId, {
          content: '抱歉，处理您的请求时出现了问题，请稍后重试。',
          status: 'error',
          errorMessage: error.message || '未知错误'
        });
        
        // 记录错误日志
        await this.promptLogModel.create({
          serviceType: config.model,
          modelName: config.model_name || this.getDefaultModelName(config.model),
          requestId: requestId,
          requestType: 'chat',
          paragraphInfo: 'IELTS Chat',
          projectId: projectId,
          versionNumber: versionNumber,
          promptContent: JSON.stringify({
            system: systemMessage,
            user: userMessage
          }),
          rawResponse: JSON.stringify(error.response?.data || error.message || ''),
          responseContent: error.message || '未知错误',
          tokenUsage: 0,
          tokenUsageDetail: {
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0
          },
          duration: Date.now() - startTime,
          status: 'error',
          errorMessage: error.message || '未知错误'
        });
        
        // 结束请求
        res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
        
        return {
          messageId: aiMessageId,
          res
        };
      }
    } catch (error: any) {
      console.error('发送流式聊天消息失败:', error);
      
      // 向客户端发送错误信息
      res.write(`data: ${JSON.stringify({ type: 'error', error: error.message || '发送流式聊天消息失败' })}\n\n`);
      
      // 结束请求
      res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
      
      throw new ApiError(error.message || '发送流式聊天消息失败', 'CHAT_ERROR', 500);
    }
  }
  
  /**
   * 流式发送请求到AI服务
   * @param config AI配置
   * @param systemMessage 系统消息
   * @param userMessage 用户消息
   * @param res Express Response对象
   * @param messageId 消息ID
   */
  private async sendToAIServiceStream(
    config: AIConfig, 
    systemMessage: string, 
    userMessage: string,
    res: any,
    messageId: string
  ): Promise<void> {
    const modelType = config.model.toLowerCase();
    const modelName = config.model_name || this.getDefaultModelName(modelType);
    
    let url = ChatService.API_URLS[modelType] || ChatService.API_URLS.doubao;
    
    let headers: any = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`
    };
    
    // 为通义千问添加SSE头
    if (modelType === 'tongyi') {
      headers['X-DashScope-SSE'] = 'enable';
    }
    
    let requestBody: any = {};
    
    // 设置流式参数，添加stream=true
    if (modelType === 'doubao') {
      // 豆包API请求体
      requestBody = {
        model: modelName,
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.5,
        max_tokens: 1000,
        top_p: 0.95,
        top_k: 40,
        stream: true
      };
    } else if (modelType === 'kimi') {
      // Kimi API请求体
      requestBody = {
        model: modelName,
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.7,
        max_tokens: 1000,
        stream: true
      };
    } else if (modelType === 'tongyi') {
      // 通义千问API请求体 - 使用OpenAI兼容模式
      // 使用compatible-mode接口替换原接口
      url = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
      
      requestBody = {
        model: modelName,
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.7,
        max_tokens: 1000,
        stream: true,
        stream_options: {
          include_usage: true
        }
      };
    } else {
      // 默认使用豆包格式
      requestBody = {
        model: modelName,
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.7,
        max_tokens: 1000,
        stream: true
      };
    }
    
    try {
      console.log(`发送流式请求到${modelType}API: ${url}, 使用模型: ${modelName}`);
      
      // 使用Axios发送请求并处理流式响应
      const response = await axios({
        method: 'post',
        url: url,
        headers: headers,
        data: requestBody,
        timeout: REQUEST_TIMEOUT,
        responseType: 'stream'
      });
      
      // 保存当前文本内容用于更新到数据库
      let fullContent = '';
      let tokenUsage = {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0
      };
      
      // 处理不同模型的流式响应
      response.data.on('data', (chunk: Buffer) => {
        try {
          const lines = chunk.toString().split('\n');
          
          for (const line of lines) {
            // 跳过空行
            if (!line.trim()) continue;
            
            // 通义千问的SSE响应格式特殊处理 (使用OpenAI兼容模式)
            if (modelType === 'tongyi') {
              // 跳过非data开头的行
              if (!line.startsWith('data:')) continue;
              
              // 提取data部分
              const jsonData = line.replace(/^data: /, '').trim();
              
              // 跳过[DONE]结束标记
              if (jsonData === '[DONE]') continue;
              
              try {
                const parsedData = JSON.parse(jsonData);
                
                // 检查是否是最后一个chunk (包含usage信息)
                if (parsedData.usage) {
                  // 记录token使用情况
                  tokenUsage = {
                    promptTokens: parsedData.usage.prompt_tokens || 0,
                    completionTokens: parsedData.usage.completion_tokens || 0,
                    totalTokens: parsedData.usage.total_tokens || 0
                  };
                  continue; // 跳过不包含内容的最后一个chunk
                }
                
                // 获取增量内容
                let deltaContent = '';
                if (parsedData.choices && parsedData.choices.length > 0) {
                  deltaContent = parsedData.choices[0].delta?.content || '';
                }
                
                if (deltaContent) {
                  // 累积完整内容
                  fullContent += deltaContent;
                  
                  // 发送增量内容到客户端
                  res.write(`data: ${JSON.stringify({ 
                    content: deltaContent, 
                    messageId: messageId,
                    type: 'chunk' 
                  })}\n\n`);
                  
                  // 定期更新数据库中的内容
                  this.updateMessageContent(messageId, fullContent);
                }
              } catch (parseError) {
                console.error('解析通义千问流式数据失败:', parseError, line);
              }
              
              // 通义千问特殊处理完毕，继续下一行
              continue;
            }
            
            // 其他模型的处理保持不变
            // 跳过非data开头的行
            if (!line.startsWith('data:')) continue;
            
            // 提取data部分
            const jsonData = line.replace(/^data: /, '').trim();
            
            // 跳过[DONE]结束标记
            if (jsonData === '[DONE]') continue;
            
            try {
              const parsedData = JSON.parse(jsonData);
              
              let deltaContent = '';
              
              // 根据不同的模型提取content
              if (modelType === 'doubao' || modelType === 'kimi') {
                deltaContent = parsedData.choices?.[0]?.delta?.content || '';
              } else {
                // 通用处理
                if (parsedData.choices && parsedData.choices[0]) {
                  if (parsedData.choices[0].delta) {
                    deltaContent = parsedData.choices[0].delta.content || '';
                  } else if (parsedData.choices[0].text) {
                    deltaContent = parsedData.choices[0].text || '';
                  }
                }
              }
              
              if (deltaContent) {
                // 累积完整内容
                fullContent += deltaContent;
                
                // 发送增量内容到客户端
                res.write(`data: ${JSON.stringify({ 
                  content: deltaContent, 
                  messageId: messageId,
                  type: 'chunk' 
                })}\n\n`);
                
                // 定期更新数据库中的内容
                this.updateMessageContent(messageId, fullContent);
              }
            } catch (parseError) {
              console.error('解析流式数据失败:', parseError);
            }
          }
        } catch (chunkError) {
          console.error('处理流式数据块失败:', chunkError);
        }
      });
      
      // 流结束后更新完整内容到数据库
      return new Promise((resolve, reject) => {
        response.data.on('end', async () => {
          try {
            await this.chatMessageModel.update(messageId, {
              content: fullContent,
              status: 'sent'
            });
            
            // 如果收集到了token使用情况，更新到日志
            if (tokenUsage.totalTokens > 0) {
              // 查找请求日志并更新token使用情况
              try {
                const logs = await this.promptLogModel.findByMessageId(messageId);
                if (logs && logs.length > 0) {
                  const log = logs[0];
                  await this.promptLogModel.updateByRequestId(log.request_id, {
                    tokenUsage: tokenUsage.totalTokens,
                    tokenUsageDetail: tokenUsage
                  });
                }
              } catch (logError) {
                console.error('更新token使用情况失败:', logError);
              }
            }
            
            resolve();
          } catch (error) {
            reject(error);
          }
        });
        
        response.data.on('error', (error: any) => {
          reject(error);
        });
      });
    } catch (error: any) {
      console.error(`发送流式请求到 ${modelType} API失败:`, error);
      
      if (error.response) {
        throw new Error(`API错误: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
      } else if (error.request) {
        throw new Error('未收到API响应，请检查网络连接');
      } else {
        throw new Error(`请求错误: ${error.message}`);
      }
    }
  }

  /**
   * 节流更新消息内容
   * 避免频繁更新数据库
   */
  private updateMessageContent = (() => {
    const pendingUpdates = new Map<string, string>();
    let updateTimeout: NodeJS.Timeout | null = null;
    
    const processUpdates = async () => {
      if (pendingUpdates.size === 0) return;
      
      const updatesCopy = new Map(pendingUpdates);
      pendingUpdates.clear();
      
      for (const [messageId, content] of updatesCopy.entries()) {
        try {
          await this.chatMessageModel.update(messageId, { 
            content,
            status: 'sending' // 保持发送中状态，直到流完成
          });
        } catch (error) {
          console.error(`更新消息内容失败 (${messageId}):`, error);
        }
      }
    };
    
    return (messageId: string, content: string) => {
      pendingUpdates.set(messageId, content);
      
      if (!updateTimeout) {
        updateTimeout = setTimeout(() => {
          processUpdates();
          updateTimeout = null;
        }, 500); // 500ms节流
      }
    };
  })();

  /**
   * 更新流式聊天日志
   * @param requestId 请求ID
   * @param content 完整的响应内容
   * @param rawResponse 原始响应数据
   * @param tokenUsage token使用情况
   */
  async updateStreamLog(
    requestId: string,
    content: string,
    rawResponse: any,
    tokenUsage: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    }
  ): Promise<void> {
    try {
      // 查找对应requestId的日志记录
      const logRecord = await this.promptLogModel.findByRequestId(requestId);
      
      if (!logRecord) {
        console.error(`未找到requestId为${requestId}的日志记录`);
        throw new ApiError('未找到日志记录', 'LOG_NOT_FOUND', 404);
      }
      
      // 更新日志记录
      await this.promptLogModel.updateByRequestId(requestId, {
        responseContent: content || '流式响应内容',
        rawResponse: JSON.stringify(rawResponse || {}),
        tokenUsage: tokenUsage?.totalTokens || 0,
        tokenUsageDetail: {
          promptTokens: tokenUsage?.promptTokens || 0,
          completionTokens: tokenUsage?.completionTokens || 0,
          totalTokens: tokenUsage?.totalTokens || 0
        }
      });
      
      console.log(`已更新流式聊天日志记录，requestId: ${requestId}`);
    } catch (error: any) {
      console.error('更新流式聊天日志失败:', error);
      throw new ApiError(error.message || '更新流式聊天日志失败', 'UPDATE_LOG_ERROR', 500);
    }
  }
}