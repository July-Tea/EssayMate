export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

export interface ValidateResponse {
  isValid: boolean;
  message?: string;
  code?: string;
}

export interface AIConfig {
  model: string;
  apiKey: string;
  model_name?: string;
  modelConfigs?: any;
  [key: string]: any;  // 允许添加其他属性
}

export interface ConfigResponse {
  id?: number;
  model: string;
  apiKey: string;
  modelConfigs?: any;
  is_active?: boolean;
  updated_at?: string;
  created_at?: string;
}

// 新增：统一的验证结果接口
export interface ValidationResult {
  isValid: boolean;
  message?: string;
  code?: string;
}

// 新增：错误类型枚举
export enum ErrorType {
  VALIDATION = 'VALIDATION',
  BUSINESS = 'BUSINESS',
  TECHNICAL = 'TECHNICAL'
}

// 新增：错误上下文接口
export interface ErrorContext {
  type: ErrorType;
  code: string;
  message: string;
  details?: any;
}

// 新增：配置状态接口
export interface ConfigState {
  status: 'initial' | 'validating' | 'saving' | 'ready' | 'error';
  config: AIConfig;
  error?: ErrorContext;
}

// 新增：配置事件接口
export interface ConfigEvent {
  type: 'CONFIG_VALIDATED' | 'CONFIG_SAVED' | 'CONFIG_ERROR';
  payload: any;
} 