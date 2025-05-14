import axios from 'axios';
import type { Project } from '../types/project';
import type { Version, FeedbackData } from '../types/feedback';
import { useConfigStore } from '../stores/config';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

// 支持的考试类型
export enum ExamType {
  IELTS = 'ielts',
  TOEFL = 'toefl',
  GRE = 'gre'
}

export interface ProjectResponse {
  project: Project;
  versions: Version[];
  feedbacks: FeedbackData[];
}

export interface VersionWithFeedbackResponse {
  project: Project;
  version: Version;
  feedback: FeedbackData;
}

export const projectApi = {
  // 创建新项目
  async create(data: Partial<Project>) {
    const response = await axios.post(`${API_BASE_URL}/projects`, data);
    return response.data.data;
  },

  // 获取所有项目
  async getAll() {
    const response = await axios.get(`${API_BASE_URL}/projects`);
    return response.data.data;
  },

  // 获取单个项目及其所有版本和反馈
  async getById(id: number): Promise<ProjectResponse> {
    const response = await axios.get(`${API_BASE_URL}/projects/${id}`);
    return response.data.data;
  },

  // 获取特定项目的特定版本及其反馈
  async getVersionWithFeedback(projectId: number, versionNumber: number): Promise<VersionWithFeedbackResponse> {
    const response = await axios.get(`${API_BASE_URL}/projects/${projectId}/versions/${versionNumber}`);
    return response.data.data;
  },

  // 创建新版本
  async createVersion(projectId: number, data: { content: string; wordCount: number }) {
    const response = await axios.post(`${API_BASE_URL}/projects/${projectId}/versions`, data);
    return response.data.data;
  },

  // 创建反馈
  async createFeedback(projectId: number, versionNumber: number, data: any) {
    console.log(`【API】开始创建反馈 - 项目ID: ${projectId}, 版本号: ${versionNumber}`, data);
    try {
      const response = await axios.post(
        `${API_BASE_URL}/projects/${projectId}/versions/${versionNumber}/feedback`,
        data
      );
      console.log('【API】创建反馈成功', response.data.data);
      return response.data.data;
    } catch (error) {
      console.error('【API】创建反馈失败', error);
      throw error;
    }
  },

  // 轮询获取批改进度
  async getFeedbackProgress(feedbackId: number) {
    // console.log(`【API】轮询批改进度 - 反馈ID: ${feedbackId}`);
    try {
      const response = await axios.get(
        `${API_BASE_URL}/ai-feedback/progress/${feedbackId}`
      );
      // console.log('【API】获取批改进度成功', response.data.data);
      return response.data.data;
    } catch (error) {
      // console.error('【API】获取批改进度失败', error);
      throw error;
    }
  },

  // 通用AI反馈生成接口
  async generateFeedback(projectId: number, versionNumber: number, model: string, options: {
    prompt?: string;
    useStepByStepStrategy?: boolean;
    targetScore?: string;
    examType?: ExamType;
    generateExampleEssay?: boolean;
  } = {}) {
    // console.log(`【API】调用${model}批改服务 - 项目ID: ${projectId}, 版本号: ${versionNumber}`, options);
    // 默认使用IELTS考试类型
    const examType = options.examType || ExamType.IELTS;
    
    try {
      console.log(`【API】批改请求URL: ${API_BASE_URL}/ai-feedback/projects/${projectId}/versions/${versionNumber}/generate/${model}`);
      console.log(`【API】${model}批改请求参数:`, { ...options, examType });
      
      const response = await axios.post(
        `${API_BASE_URL}/ai-feedback/projects/${projectId}/versions/${versionNumber}/generate/${model}`,
        { ...options, examType }
      );
      
      console.log(`【API】${model}批改请求成功`, response.data);
      return response.data.data;
    } catch (error) {
      console.error(`【API】${model}批改请求失败`, error);
      // 详细输出错误信息
      if (axios.isAxiosError(error) && error.response) {
        console.error(`【API】${model}批改错误状态码:`, error.response.status);
        console.error(`【API】${model}批改错误数据:`, error.response.data);
      }
      throw error;
    }
  },
  
  // 使用活跃模型进行批改 (替代原先的豆包批改方法)
  async generateActiveFeedback(projectId: number, versionNumber: number, options: {
    prompt?: string;
    useStepByStepStrategy?: boolean;
    targetScore?: string;
    examType?: ExamType;
    generateExampleEssay?: boolean;
  } = {}) {
    console.log(`【API】调用活跃模型批改服务 - 项目ID: ${projectId}, 版本号: ${versionNumber}`, options);
    
    try {
      // 使用配置存储中的活跃模型
      const configStore = useConfigStore();
      const activeModelName = configStore.config.model || 'doubao';
      console.log(`【API】使用活跃模型: ${activeModelName}`);
      
      // 确保每次都生成范文
      const optionsWithExampleEssay = {
        ...options,
        generateExampleEssay: true
      };
      
      // 使用通用生成函数
      return await this.generateFeedback(projectId, versionNumber, activeModelName.toLowerCase(), optionsWithExampleEssay);
    } catch (error) {
      console.error('【API】批改请求失败', error);
      throw error;
    }
  },

  // 为向后兼容保留的豆包反馈生成方法 (使用活跃模型方法的别名)
  // @deprecated 此方法已废弃，请使用generateActiveFeedback方法
  async generateDoubaoFeedback(projectId: number, versionNumber: number, options: {
    prompt?: string;
    useStepByStepStrategy?: boolean;
    targetScore?: string;
    examType?: ExamType;
    generateExampleEssay?: boolean;
  } = {}) {
    console.warn('【API】调用的是旧版豆包批改方法名称，已自动使用活跃模型进行批改');
    return this.generateActiveFeedback(projectId, versionNumber, options);
  },

  // 生成范文 (关联项目版本)
  async generateExampleEssay(projectId: number, versionNumber: number, model: string, options: {
    prompt: string;
    examType?: ExamType;
    examCategory?: string;
    targetScore?: string;
  }) {
    console.log(`【API】生成范文 - 项目ID: ${projectId}, 版本号: ${versionNumber}, 模型: ${model}`);
    
    try {
      const response = await axios.post(
        `${API_BASE_URL}/ai-feedback/projects/${projectId}/versions/${versionNumber}/example-essay/${model}`,
        options
      );
      
      console.log(`【API】范文生成成功`, response.data);
      return response.data.data;
    } catch (error) {
      console.error(`【API】范文生成失败`, error);
      if (axios.isAxiosError(error) && error.response) {
        console.error(`【API】范文生成错误状态码:`, error.response.status);
        console.error(`【API】范文生成错误数据:`, error.response.data);
      }
      throw error;
    }
  },
  
  // 生成范文 (不关联项目)
  async generateStandaloneExampleEssay(model: string, options: {
    prompt: string;
    examType?: ExamType;
    examCategory?: string;
    targetScore?: string;
  }) {
    console.log(`【API】生成独立范文 - 模型: ${model}`);
    
    try {
      const response = await axios.post(
        `${API_BASE_URL}/ai-feedback/example-essay/${model}`,
        options
      );
      
      console.log(`【API】独立范文生成成功`, response.data);
      return response.data.data;
    } catch (error) {
      console.error(`【API】独立范文生成失败`, error);
      if (axios.isAxiosError(error) && error.response) {
        console.error(`【API】独立范文生成错误状态码:`, error.response.status);
        console.error(`【API】独立范文生成错误数据:`, error.response.data);
      }
      throw error;
    }
  },

  // 更新反馈状态
  async updateFeedbackStatus(projectId: number, versionNumber: number, status: string) {
    const response = await axios.patch(
      `${API_BASE_URL}/projects/${projectId}/versions/${versionNumber}/feedback/status`,
      { status }
    );
    return response.data.data;
  },

  // 删除项目
  async deleteProject(id: number) {
    const response = await axios.patch(`${API_BASE_URL}/projects/${id}/delete`);
    return response.data.data;
  },

  // 获取范文
  async getExampleEssay(projectId: number, versionNumber: number) {
    console.log(`【API】获取范文 - 项目ID: ${projectId}, 版本号: ${versionNumber}`);
    try {
      const response = await axios.get(
        `${API_BASE_URL}/projects/${projectId}/versions/${versionNumber}/example-essay`
      );
      console.log('【API】获取范文成功', response.data.data);
      return response.data.data;
    } catch (error) {
      console.error('【API】获取范文失败', error);
      throw error;
    }
  },
}; 

// 添加聊天API
export const chatApi = {
  // 获取聊天历史
  async getChatHistory(projectId: number, versionNumber: number, sessionId?: string) {
    const url = sessionId 
      ? `${API_BASE_URL}/chat/${projectId}/${versionNumber}?sessionId=${sessionId}`
      : `${API_BASE_URL}/chat/${projectId}/${versionNumber}`;
    
    try {
      const response = await axios.get(url);
      return response.data.data;
    } catch (error) {
      console.error('获取聊天历史失败:', error);
      throw error;
    }
  },
  
  // 创建新的聊天会话
  async createChatSession(projectId: number, versionNumber: number) {
    try {
      const response = await axios.post(`${API_BASE_URL}/chat/session/${projectId}/${versionNumber}`);
      return response.data.data.sessionId;
    } catch (error) {
      console.error('创建聊天会话失败:', error);
      throw error;
    }
  },
  
  // 发送聊天消息
  async sendMessage(data: {
    projectId: number;
    versionNumber: number;
    sessionId: string;
    message: string;
    parentId?: string;
    examType?: string;
    taskType?: string;
    title?: string;
    content?: string;
  }) {
    try {
      const response = await axios.post(`${API_BASE_URL}/chat/send`, data);
      return response.data.data;
    } catch (error) {
      console.error('发送聊天消息失败:', error);
      throw error;
    }
  },
  
  // 流式发送聊天消息
  sendMessageStream(data: {
    projectId: number;
    versionNumber: number;
    sessionId: string;
    message: string;
    parentId?: string;
    examType?: string;
    taskType?: string;
    title?: string;
    content?: string;
  }, callbacks: {
    onStart?: (messageId: string, requestId: string) => void;
    onChunk?: (chunk: { content: string, messageId: string }) => void;
    onComplete?: (fullContent: string) => void;
    onError?: (error: any) => void;
  }) {
    // 创建一个URLSearchParams对象来构建查询参数
    const params = new URLSearchParams();
    
    // 将所有数据添加到查询参数中
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, String(value));
      }
    });
    
    // 构建URL，使用POST方法，所以不添加查询参数
    const url = `${API_BASE_URL}/chat/send-stream`;
    
    // 初始化EventSource以取消连接
    let eventSource: EventSource | null = null;
    
    // 创建一个AbortController来取消fetch请求
    const controller = new AbortController();
    
    // 用于记录完整内容
    let fullContent = '';
    
    // 保存requestId
    let currentRequestId = '';
    
    // 使用fetch API发送POST请求，并返回一个清理函数
    const cleanup = fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
      signal: controller.signal
    })
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }
      
      // 获取响应的reader，用于读取流
      const reader = response.body!.getReader();
      const decoder = new TextDecoder('utf-8');
      
      // 处理流数据
      function processStream(): Promise<void> {
        return reader.read().then(({ done, value }) => {
          if (done) {
            // 流结束，尝试更新日志
            if (currentRequestId && fullContent) {
              // 简单估算token数量
              const promptTokens = Math.ceil((data.message.length + 50) / 4);
              const completionTokens = Math.ceil(fullContent.length / 4);
              
              // 异步更新日志，不等待结果
              chatApi.updateStreamLog(currentRequestId, fullContent, {
                promptTokens,
                completionTokens,
                totalTokens: promptTokens + completionTokens
              }).catch(e => console.error('更新流式日志失败:', e));
            }
            
            // 调用完成回调
            callbacks.onComplete?.(fullContent);
            return;
          }
          
          // 解码二进制数据为文本
          const chunk = decoder.decode(value, { stream: true });
          
          // 解析SSE格式数据
          const lines = chunk.split('\n\n');
          
          for (const line of lines) {
            if (!line.trim() || !line.startsWith('data:')) continue;
            
            try {
              // 提取JSON数据
              const jsonData = line.replace(/^data: /, '').trim();
              const parsedData = JSON.parse(jsonData);
              
              // 根据消息类型处理
              if (parsedData.type === 'init') {
                // 初始化消息，保存requestId
                currentRequestId = parsedData.requestId;
                
                // 初始化消息
                callbacks.onStart?.(parsedData.messageId, parsedData.requestId);
              } else if (parsedData.type === 'chunk') {
                // 累积完整内容
                fullContent += parsedData.content;
                
                // 内容片段
                callbacks.onChunk?.(parsedData);
              } else if (parsedData.type === 'error') {
                // 错误消息
                callbacks.onError?.(new Error(parsedData.error));
                return; // 停止处理流
              } else if (parsedData.type === 'done') {
                // 流结束，尝试更新日志
                if (currentRequestId && fullContent) {
                  // 简单估算token数量
                  const promptTokens = Math.ceil((data.message.length + 50) / 4);
                  const completionTokens = Math.ceil(fullContent.length / 4);
                  
                  // 异步更新日志，不等待结果
                  chatApi.updateStreamLog(currentRequestId, fullContent, {
                    promptTokens,
                    completionTokens,
                    totalTokens: promptTokens + completionTokens
                  }).catch(e => console.error('更新流式日志失败:', e));
                }
                
                // 完成
                callbacks.onComplete?.(fullContent);
                return; // 停止处理流
              }
            } catch (error) {
              console.error('解析SSE数据失败:', error, line);
            }
          }
          
          // 继续处理流
          return processStream();
        }).catch(error => {
          callbacks.onError?.(error);
        });
      }
      
      // 开始处理流
      return processStream();
    })
    .catch(error => {
      callbacks.onError?.(error);
    });
    
    // 返回一个函数，用于取消请求
    return () => {
      controller.abort();
      
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
    };
  },
  
  // 更新流式聊天日志
  async updateStreamLog(
    requestId: string,
    content: string,
    tokenUsage: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    }
  ) {
    try {
      // 创建模拟的原始响应数据
      const rawResponse = {
        type: 'stream_result',
        usage: {
          prompt_tokens: tokenUsage.promptTokens,
          completion_tokens: tokenUsage.completionTokens,
          total_tokens: tokenUsage.totalTokens
        },
        timestamp: new Date().toISOString()
      };
      
      // 发送请求更新日志
      await axios.post(`${API_BASE_URL}/chat/update-stream-log`, {
        requestId,
        content,
        rawResponse,
        tokenUsage
      });
      
      console.log('成功更新流式聊天日志');
    } catch (error) {
      console.error('更新流式聊天日志失败:', error);
      throw error;
    }
  },
  
  // 删除消息
  async deleteMessage(messageId: string) {
    try {
      const response = await axios.delete(`${API_BASE_URL}/chat/message/${messageId}`);
      return response.data;
    } catch (error) {
      console.error('删除消息失败:', error);
      throw error;
    }
  },
  
  // 删除会话
  async deleteSession(sessionId: string) {
    try {
      const response = await axios.delete(`${API_BASE_URL}/chat/session/${sessionId}`);
      return response.data;
    } catch (error) {
      console.error('删除会话失败:', error);
      throw error;
    }
  }
}; 