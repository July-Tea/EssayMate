import { Database } from 'sqlite3';
import { FeedbackStatus } from '../types/common';

export interface Annotation {
  type: 'suggestion' | 'correction' | 'highlight';
  original_content: string;
  correction_content: string;
  suggestion: string;
}

export interface ImprovementSuggestion {
  category: string;
  content: string;
  priority: 'high' | 'medium' | 'low';
}

export interface Feedback {
  id: number;
  projectId: number;
  essayVersionId: number;
  versionNumber: number;
  status: FeedbackStatus;
  isDel: number;
  
  // 分数
  scoreTR: number;
  scoreCC: number;
  scoreLR: number;
  scoreGRA: number;
  overallScore: number;
  
  // 评语
  feedbackTR: string;
  feedbackCC: string;
  feedbackLR: string;
  feedbackGRA: string;
  overallFeedback?: string;
  
  // 批注和建议
  annotations?: Annotation[];
  improvementSuggestions?: ImprovementSuggestion[];
  
  // 时间
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface FeedbackCreate {
  projectId: number;
  essayVersionId: number;
  versionNumber: number;
  
  scoreTR: number;
  scoreCC: number;
  scoreLR: number;
  scoreGRA: number;
  
  feedbackTR: string;
  feedbackCC: string;
  feedbackLR: string;
  feedbackGRA: string;
  overallFeedback?: string;
  
  annotations?: Annotation[];
  improvementSuggestions?: ImprovementSuggestion[];
}

export interface FeedbackUpdate {
  status?: FeedbackStatus;
  scoreTR?: number;
  scoreCC?: number;
  scoreLR?: number;
  scoreGRA?: number;
  feedbackTR?: string;
  feedbackCC?: string;
  feedbackLR?: string;
  feedbackGRA?: string;
  overallFeedback?: string;
  annotations?: Annotation[];
  improvementSuggestions?: ImprovementSuggestion[];
  startedAt?: Date;
  completedAt?: Date;
}

export class FeedbackModel {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  private serializeJSON(data: any): string | null {
    if (!data) return null;
    try {
      return JSON.stringify(data);
    } catch (e) {
      console.error('JSON序列化失败:', e);
      return null;
    }
  }

  private parseJSON<T>(data: string | null): T | undefined {
    if (!data) return undefined;
    try {
      return JSON.parse(data) as T;
    } catch (e) {
      console.error('JSON解析失败:', e);
      return undefined;
    }
  }

  async create(feedback: FeedbackCreate): Promise<Feedback> {
    const now = new Date();
    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT INTO feedbacks (
          project_id, essay_version_id, version_number, status,
          score_tr, score_cc, score_lr, score_gra,
          feedback_tr, feedback_cc, feedback_lr, feedback_gra, overall_feedback,
          annotations, improvement_suggestions,
          created_at, updated_at, is_del
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
        [
          feedback.projectId,
          feedback.essayVersionId,
          feedback.versionNumber,
          FeedbackStatus.PENDING,
          feedback.scoreTR,
          feedback.scoreCC,
          feedback.scoreLR,
          feedback.scoreGRA,
          feedback.feedbackTR,
          feedback.feedbackCC,
          feedback.feedbackLR,
          feedback.feedbackGRA,
          feedback.overallFeedback || null,
          this.serializeJSON(feedback.annotations),
          this.serializeJSON(feedback.improvementSuggestions),
          now.toISOString(),
          now.toISOString()
        ],
        function(err) {
          if (err) return reject(err);
          
          resolve({
            id: this.lastID,
            ...feedback,
            status: FeedbackStatus.PENDING,
            isDel: 0,
            overallScore: (feedback.scoreTR + feedback.scoreCC + feedback.scoreLR + feedback.scoreGRA) / 4,
            createdAt: now,
            updatedAt: now
          });
        }
      );
    });
  }

  async findByProjectId(projectId: number): Promise<Feedback[]> {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT * FROM feedbacks 
         WHERE project_id = ? AND is_del = 0 
         ORDER BY version_number ASC`,
        [projectId],
        (err, rows: any[]) => {
          if (err) return reject(err);
          
          const feedbacks = rows.map(row => ({
            id: row.id,
            projectId: row.project_id,
            essayVersionId: row.essay_version_id,
            versionNumber: row.version_number,
            status: row.status as FeedbackStatus,
            isDel: row.is_del,
            
            scoreTR: row.score_tr,
            scoreCC: row.score_cc,
            scoreLR: row.score_lr,
            scoreGRA: row.score_gra,
            overallScore: row.overall_score,
            
            feedbackTR: row.feedback_tr,
            feedbackCC: row.feedback_cc,
            feedbackLR: row.feedback_lr,
            feedbackGRA: row.feedback_gra,
            overallFeedback: row.overall_feedback,
            
            annotations: this.parseJSON<Annotation[]>(row.annotations),
            improvementSuggestions: this.parseJSON<ImprovementSuggestion[]>(row.improvement_suggestions),
            
            startedAt: row.started_at ? new Date(row.started_at) : undefined,
            completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
            createdAt: new Date(row.created_at),
            updatedAt: new Date(row.updated_at)
          }));
          
          resolve(feedbacks);
        }
      );
    });
  }

  async findByVersionId(essayVersionId: number): Promise<Feedback | null> {
    return new Promise((resolve, reject) => {
      this.db.get(
        `SELECT * FROM feedbacks 
         WHERE essay_version_id = ? AND is_del = 0`,
        [essayVersionId],
        (err, row: any) => {
          if (err) return reject(err);
          if (!row) return resolve(null);
          
          resolve({
            id: row.id,
            projectId: row.project_id,
            essayVersionId: row.essay_version_id,
            versionNumber: row.version_number,
            status: row.status as FeedbackStatus,
            isDel: row.is_del,
            
            scoreTR: row.score_tr,
            scoreCC: row.score_cc,
            scoreLR: row.score_lr,
            scoreGRA: row.score_gra,
            overallScore: row.overall_score,
            
            feedbackTR: row.feedback_tr,
            feedbackCC: row.feedback_cc,
            feedbackLR: row.feedback_lr,
            feedbackGRA: row.feedback_gra,
            overallFeedback: row.overall_feedback,
            
            annotations: this.parseJSON<Annotation[]>(row.annotations),
            improvementSuggestions: this.parseJSON<ImprovementSuggestion[]>(row.improvement_suggestions),
            
            startedAt: row.started_at ? new Date(row.started_at) : undefined,
            completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
            createdAt: new Date(row.created_at),
            updatedAt: new Date(row.updated_at)
          });
        }
      );
    });
  }

  async findById(id: number): Promise<Feedback | null> {
    return new Promise((resolve, reject) => {
      this.db.get(
        `SELECT * FROM feedbacks 
         WHERE id = ? AND is_del = 0`,
        [id],
        (err, row: any) => {
          if (err) return reject(err);
          if (!row) return resolve(null);
          
          resolve({
            id: row.id,
            projectId: row.project_id,
            essayVersionId: row.essay_version_id,
            versionNumber: row.version_number,
            status: row.status as FeedbackStatus,
            isDel: row.is_del,
            
            scoreTR: row.score_tr,
            scoreCC: row.score_cc,
            scoreLR: row.score_lr,
            scoreGRA: row.score_gra,
            overallScore: row.overall_score,
            
            feedbackTR: row.feedback_tr,
            feedbackCC: row.feedback_cc,
            feedbackLR: row.feedback_lr,
            feedbackGRA: row.feedback_gra,
            overallFeedback: row.overall_feedback,
            
            annotations: this.parseJSON<Annotation[]>(row.annotations),
            improvementSuggestions: this.parseJSON<ImprovementSuggestion[]>(row.improvement_suggestions),
            
            startedAt: row.started_at ? new Date(row.started_at) : undefined,
            completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
            createdAt: new Date(row.created_at),
            updatedAt: new Date(row.updated_at)
          });
        }
      );
    });
  }

  async update(id: number, updateData: FeedbackUpdate): Promise<void> {
    const now = new Date();
    
    // 构建更新字段
    const updateFields: string[] = [];
    const updateValues: any[] = [];
    
    Object.entries(updateData).forEach(([key, value]) => {
      if (value !== undefined) {
        let fieldName = '';
        
        // 将驼峰命名转为下划线命名
        switch (key) {
          case 'scoreTR':
            fieldName = 'score_tr';
            break;
          case 'scoreCC':
            fieldName = 'score_cc';
            break;
          case 'scoreLR':
            fieldName = 'score_lr';
            break;
          case 'scoreGRA':
            fieldName = 'score_gra';
            break;
          case 'feedbackTR':
            fieldName = 'feedback_tr';
            break;
          case 'feedbackCC':
            fieldName = 'feedback_cc';
            break;
          case 'feedbackLR':
            fieldName = 'feedback_lr';
            break;
          case 'feedbackGRA':
            fieldName = 'feedback_gra';
            break;
          case 'overallFeedback':
            fieldName = 'overall_feedback';
            break;
          case 'annotations':
          case 'improvementSuggestions':
            fieldName = key.replace(/([A-Z])/g, '_$1').toLowerCase();
            value = this.serializeJSON(value);
            break;
          default:
            fieldName = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        }
        
        updateFields.push(`${fieldName} = ?`);
        updateValues.push(value);
      }
    });
    
    // 添加更新时间
    updateFields.push('updated_at = ?');
    updateValues.push(now.toISOString());
    
    // 添加完成时间（如果状态是已完成）
    if (updateData.status === FeedbackStatus.COMPLETED) {
      updateFields.push('completed_at = ?');
      updateValues.push(now.toISOString());
    }
    
    // 添加开始时间（如果状态是进行中）
    if (updateData.status === FeedbackStatus.IN_PROGRESS) {
      updateFields.push('started_at = ?');
      updateValues.push(now.toISOString());
    }
    
    // 构建更新SQL
    const updateSql = `
      UPDATE feedbacks 
      SET ${updateFields.join(', ')}
      WHERE id = ?
    `;
    
    // 添加ID到参数列表
    updateValues.push(id);
    
    return new Promise((resolve, reject) => {
      this.db.run(updateSql, updateValues, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });
  }

  async updateStatus(id: number, status: FeedbackStatus): Promise<void> {
    const now = new Date();
    return new Promise((resolve, reject) => {
      this.db.run(
        `UPDATE feedbacks 
         SET status = ?,
             ${status === FeedbackStatus.IN_PROGRESS ? 'started_at = ?,' : ''}
             ${status === FeedbackStatus.COMPLETED ? 'completed_at = ?,' : ''}
             updated_at = ?
         WHERE id = ?`,
        [
          status,
          ...(status === FeedbackStatus.IN_PROGRESS ? [now.toISOString()] : []),
          ...(status === FeedbackStatus.COMPLETED ? [now.toISOString()] : []),
          now.toISOString(),
          id
        ],
        (err) => {
          if (err) return reject(err);
          resolve();
        }
      );
    });
  }

  /**
   * 更新反馈开始时间
   * @param id 反馈ID
   */
  async updateStartTime(id: number): Promise<void> {
    const now = new Date();
    return new Promise((resolve, reject) => {
      this.db.run(
        `UPDATE feedbacks 
         SET started_at = ?,
             updated_at = ?
         WHERE id = ?`,
        [now.toISOString(), now.toISOString(), id],
        (err) => {
          if (err) return reject(err);
          resolve();
        }
      );
    });
  }

  /**
   * 更新反馈完成时间
   * @param id 反馈ID
   */
  async updateCompletionTime(id: number): Promise<void> {
    const now = new Date();
    return new Promise((resolve, reject) => {
      this.db.run(
        `UPDATE feedbacks 
         SET completed_at = ?,
             updated_at = ?
         WHERE id = ?`,
        [now.toISOString(), now.toISOString(), id],
        (err) => {
          if (err) return reject(err);
          resolve();
        }
      );
    });
  }

  async deleteByProjectId(projectId: number): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(
        'UPDATE feedbacks SET is_del = 1, updated_at = ? WHERE project_id = ?',
        [new Date().toISOString(), projectId],
        (err) => {
          if (err) return reject(err);
          resolve();
        }
      );
    });
  }
} 