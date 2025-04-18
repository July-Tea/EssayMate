export interface Project {
  id: number;
  title: string;
  prompt: string;
  examType: string;
  category: string;
  targetScore?: string;
  currentVersion: number;
  status: string;
  totalVersions: number;
  chartImage?: any; // 存储图片相关信息
  isDel: number;
  createdAt: string;
  updatedAt: string;
} 