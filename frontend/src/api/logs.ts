import axios from 'axios';

export interface LogItem {
  id: number;
  request_id: string;
  service_type?: string;
  model_name?: string;
  request_type: string;
  paragraph_info: string;
  project_id?: number;
  version_number?: number;
  prompt_content?: string;
  response_content?: string;
  raw_response?: string;
  status: string;
  error_message?: string;
  duration: number;
  created_at: string;
  token_usage?: number;
}

export interface LogsQueryParams {
  serviceType?: string;
  modelName?: string;
  requestType?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
  isProjectDeleted?: boolean;
}

/**
 * 获取日志列表
 */
export async function getLogs(params?: LogsQueryParams): Promise<{ logs: LogItem[], total: number }> {
  const response = await axios.get('http://localhost:3000/api/logs', { params });
  return response.data;
}

/**
 * 获取可用的服务类型列表
 */
export async function getServiceTypes(): Promise<string[]> {
  const response = await axios.get('http://localhost:3000/api/logs/service-types');
  return response.data;
}

/**
 * 获取可用的模型名称列表
 */
export async function getModelNames(): Promise<string[]> {
  const response = await axios.get('http://localhost:3000/api/logs/model-names');
  return response.data;
} 