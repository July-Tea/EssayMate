export enum ProjectStatus {
  DRAFT = 'draft',           // 初始草稿
  SUBMITTED = 'submitted',   // 已提交等待批改
  PROCESSING = 'processing', // 处理中
  REVIEWED = 'reviewed',     // 已批改
  REVISING = 'revising',    // 修改中
  COMPLETED = 'completed'    // 完成所有修改
}

export enum FeedbackStatus {
  PENDING = 'pending',       // 等待批改
  IN_PROGRESS = 'in_progress', // 批改中
  COMPLETED = 'completed',    // 批改完成
  FAILED = 'failed'
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
} 