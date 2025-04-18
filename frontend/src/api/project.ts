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