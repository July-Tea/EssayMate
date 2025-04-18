// 评分维度类型
export interface ScoreDimension {
  key: 'TR' | 'CC' | 'LR' | 'GRA'
  name: string
  description: string
}

// 分数类型
export interface Scores {
  TR: number
  CC: number
  LR: number
  GRA: number
}

// 批注类型
export interface Annotation {
  type: 'suggestion' | 'correction' | 'highlight'
  original_content: string
  correction_content: string
  suggestion: string
  id?: number // 保留id字段，仅用于前端内部匹配
  // 为了维持向后兼容性，保留这些字段但标记为可选
  content?: string
  position?: {
    start: number
    end: number
  }
}

// 改进建议类型
export interface ImprovementSuggestion {
  category: string
  content: string
  priority: 'high' | 'medium' | 'low'
}

// 版本类型
export interface Version {
  id: number
  projectId: number
  versionNumber: number
  content: string[]
  wordCount: number
  status: string
  createdAt: string
  updatedAt: string
}

// 范文类型
export interface ExampleEssay {
  id: number
  projectId: number
  versionNumber: number
  content?: string
  exampleContent?: string[] | string
  improvement: string
  wordCount?: number
  status?: string
  createdAt: string
  updatedAt: string
}

// 反馈数据类型
export interface FeedbackData {
  id: number
  projectId: number
  essayVersionId: number
  versionNumber: number
  status: string
  
  // 分数
  scores: {
    TR: number
    CC: number
    LR: number
    GRA: number
  }
  overallScore: number
  
  // 评语
  feedback: {
    TR: string
    CC: string
    LR: string
    GRA: string
    overall?: string
  }
  
  // 批注和建议
  annotations?: Annotation[]
  improvementSuggestions?: ImprovementSuggestion[]
  
  // 时间
  startedAt?: string
  completedAt?: string
  createdAt: string
  updatedAt: string
  
  // 历史数据
  previousScore?: number
  targetScore?: string
} 