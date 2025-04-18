import axios from 'axios';
import { ElMessage } from 'element-plus';

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

// 创建axios实例
const api = axios.create({
  baseURL: 'http://localhost:3000',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// 请求拦截器
api.interceptors.request.use(
  (config) => {
    // 添加时间戳参数，确保不使用浏览器缓存
    if (config.method === 'get') {
      config.params = {
        ...config.params,
        t: new Date().getTime()
      };
    }
    
    // 添加请求头，禁用缓存
    if (config.headers) {
      config.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
      config.headers['Pragma'] = 'no-cache';
      config.headers['Expires'] = '0';
    }
    
    return config;
  },
  (error) => {
    console.error('请求错误:', error);
    return Promise.reject(error);
  }
);

// 响应拦截器
api.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    if (error.response) {
      // 服务器返回错误状态码
      console.error('服务器响应错误:', {
        status: error.response.status,
        data: error.response.data
      });

      // 如果是500错误且未超过重试次数，尝试重试
      if (error.response.status === 500 && (!originalRequest._retry || originalRequest._retry < MAX_RETRIES)) {
        originalRequest._retry = (originalRequest._retry || 0) + 1;
        
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
        console.log(`正在重试请求... (第 ${originalRequest._retry} 次)`);
        
        return api(originalRequest);
      }

      // 根据错误状态码显示不同的错误消息
      switch (error.response.status) {
        case 400:
          ElMessage.error('请求参数错误');
          break;
        case 401:
          ElMessage.error('未授权，请检查API密钥');
          break;
        case 403:
          ElMessage.error('访问被拒绝');
          break;
        case 404:
          ElMessage.error('请求的资源不存在');
          break;
        case 500:
          ElMessage.error('服务器内部错误');
          break;
        default:
          ElMessage.error('未知错误');
      }
    } else if (error.request) {
      // 请求已发出但没有收到响应
      console.error('未收到服务器响应:', error.request);
      ElMessage.error('无法连接到服务器，请检查网络连接');
    } else {
      // 请求配置出错
      console.error('请求配置错误:', error.message);
      ElMessage.error('请求配置错误');
    }

    return Promise.reject(error);
  }
);

// 项目相关API
export const projectApi = {
  // 获取所有项目
  getProjects: async () => {
    try {
      const response = await api.get('/api/projects');
      
      // 获取带有版本和反馈信息的完整项目数据
      const projects = response.data.data || [];
      const projectsWithDetails = await Promise.all(
        projects.map(async (project: any) => {
          try {
            // 获取项目的详细信息，包括版本和反馈
            const details = await projectApi.getProject(project.id.toString());
            return {
              ...project,
              // 添加版本信息
              versions: details.versions || [],
              // 添加反馈信息
              feedbacks: details.feedbacks || []
            };
          } catch (error) {
            console.error(`获取项目 ${project.id} 详情失败:`, error);
            return project;
          }
        })
      );
      
      return projectsWithDetails || [];
    } catch (error) {
      console.error('获取项目列表失败:', error);
      throw error;
    }
  },

  // 获取单个项目
  getProject: async (id: string) => {
    try {
      const response = await api.get(`/api/projects/${id}`);
      return response.data.data;
    } catch (error) {
      console.error(`获取项目 ${id} 失败:`, error);
      throw error;
    }
  },

  // 创建新项目
  createProject: async (projectData: {
    title: string;
    prompt: string;
    examType: string;
    category: string;
    targetScore?: string;
    chartImage?: any;
  }) => {
    try {
      // 处理chartImage字段，确保它是JSON格式
      const formattedData = {
        ...projectData,
        chartImage: projectData.chartImage ? JSON.stringify(projectData.chartImage) : null,
        isDel: 0
      };
      
      const response = await api.post('/api/projects', formattedData);
      
      // 解析返回的数据中的chartImage字段
      if (response.data.data && response.data.data.chartImage && typeof response.data.data.chartImage === 'string') {
        try {
          response.data.data.chartImage = JSON.parse(response.data.data.chartImage);
        } catch (e) {
          console.error('解析chartImage失败:', e);
        }
      }
      
      return response.data.data;
    } catch (error) {
      console.error('创建项目失败:', error);
      throw error;
    }
  },

  // 更新项目
  updateProject: async (id: string, projectData: {
    title?: string;
    content?: string;
    feedback?: string;
    actualScore?: string;
    chartImage?: any;
  }) => {
    try {
      // 处理chartImage字段，确保它是JSON格式
      const formattedData = { ...projectData };
      if (formattedData.chartImage !== undefined) {
        formattedData.chartImage = formattedData.chartImage ? JSON.stringify(formattedData.chartImage) : null;
      }
      
      const response = await api.put(`/api/projects/${id}`, formattedData);
      
      // 解析返回的数据中的chartImage字段
      if (response.data.data && response.data.data.chartImage && typeof response.data.data.chartImage === 'string') {
        try {
          response.data.data.chartImage = JSON.parse(response.data.data.chartImage);
        } catch (e) {
          console.error('解析chartImage失败:', e);
        }
      }
      
      return response.data.data;
    } catch (error) {
      console.error(`更新项目 ${id} 失败:`, error);
      throw error;
    }
  },

  // 删除项目（软删除）
  deleteProject: async (id: number) => {
    try {
      const response = await api.patch(`/api/projects/${id}/delete`);
      return response.data.data;
    } catch (error) {
      console.error(`删除项目 ${id} 失败:`, error);
      throw error;
    }
  },

  // 创建新版本
  createVersion: async (projectId: string, versionData: {
    content: string[];
    wordCount: number;
  }) => {
    try {
      const response = await api.post(`/api/projects/${projectId}/versions`, versionData);
      return response.data.data;
    } catch (error) {
      console.error(`创建项目 ${projectId} 的新版本失败:`, error);
      throw error;
    }
  }
};

export default api; 