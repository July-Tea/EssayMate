import { Database } from 'sqlite3';
import { getDatabaseConnection } from '../data-source';

export interface LogItem {
  id: number;
  request_id: string;
  service_type?: string;
  model_name?: string;
  request_type: string;
  paragraph_info: string;
  project_id?: number;
  version_number?: number;
  prompt_content: string;
  raw_response: string;
  response_content: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  duration: number;
  status: string;
  error_message?: string;
  created_at: string;
}

export interface LogQueryParams {
  limit?: number;
  offset?: number;
  serviceType?: string;
  modelName?: string;
  requestType?: string;
  status?: string;
  projectId?: number;
  startDate?: Date;
  endDate?: Date;
  isProjectDeleted?: boolean;
}

export class PromptLogModel {
  private db: Database;

  constructor(db?: Database) {
    this.db = db || getDatabaseConnection();
  }

  async create(data: {
    serviceType: string;
    modelName: string;
    requestId: string;
    requestType: 'feedback' | 'annotation' | 'example_essay' | 'chat';
    paragraphInfo: string;
    projectId?: number;
    versionNumber?: number;
    promptContent: string;
    rawResponse: string;
    responseContent: string;
    tokenUsage: number;
    tokenUsageDetail: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
    duration: number;
    status: 'success' | 'error';
    errorMessage?: string;
  }): Promise<void> {
    return this.logPrompt(
      data.requestId,
      data.requestType,
      data.paragraphInfo,
      data.projectId,
      data.versionNumber,
      data.promptContent,
      data.rawResponse,
      data.responseContent,
      data.tokenUsageDetail,
      data.duration,
      data.status,
      data.errorMessage,
      data.serviceType,
      data.modelName
    );
  }

  async logPrompt(
    requestId: string,
    requestType: 'feedback' | 'annotation' | 'example_essay' | 'chat',
    paragraphInfo: string,
    projectId: number | undefined,
    versionNumber: number | undefined,
    promptContent: string,
    rawResponse: string,
    responseContent: string,
    tokenUsageDetail: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    },
    duration: number,
    status: 'success' | 'error',
    errorMessage?: string,
    serviceType?: string,
    modelName?: string
  ): Promise<void> {
    try {
      await this.alterTable(this.db);
      
      await this.db.run(
        `INSERT INTO prompt_logs (
          request_id, request_type, paragraph_info, project_id, version_number,
          prompt_content, raw_response, response_content,
          prompt_tokens, completion_tokens, total_tokens,
          duration, status, error_message, service_type, model_name, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
        [
          requestId,
          requestType,
          paragraphInfo,
          projectId,
          versionNumber,
          promptContent,
          rawResponse,
          responseContent,
          tokenUsageDetail.promptTokens,
          tokenUsageDetail.completionTokens,
          tokenUsageDetail.totalTokens,
          duration,
          status,
          errorMessage,
          serviceType,
          modelName
        ]
      );
    } catch (error) {
      console.error('记录提示日志失败:', error);
      throw error;
    }
  }

  /**
   * 查询日志列表
   */
  async findAll(params: LogQueryParams = {}): Promise<{ logs: LogItem[], total: number }> {
    const {
      limit = 20,
      offset = 0,
      serviceType,
      modelName,
      requestType,
      status,
      projectId,
      startDate,
      endDate,
      isProjectDeleted
    } = params;

    try {
      // 构建查询条件
      const conditions: string[] = [];
      const queryParams: any[] = [];

      if (serviceType) {
        conditions.push('l.service_type = ?');
        queryParams.push(serviceType);
      }

      if (modelName) {
        conditions.push('l.model_name = ?');
        queryParams.push(modelName);
      }

      if (requestType) {
        conditions.push('l.request_type = ?');
        queryParams.push(requestType);
      }

      if (status) {
        conditions.push('l.status = ?');
        queryParams.push(status);
      }

      if (projectId !== undefined) {
        conditions.push('l.project_id = ?');
        queryParams.push(projectId);
      }

      if (startDate) {
        conditions.push('l.created_at >= datetime(?)');
        queryParams.push(startDate.toISOString());
      }

      if (endDate) {
        conditions.push('l.created_at <= datetime(?)');
        queryParams.push(endDate.toISOString());
      }

      // 是否加入已删除项目的筛选条件
      if (isProjectDeleted !== undefined) {
        // 如果项目ID为空（即没有关联项目的日志），则排除掉
        conditions.push('(l.project_id IS NULL OR (l.project_id IS NOT NULL AND p.is_del = ?))');
        queryParams.push(isProjectDeleted ? 1 : 0);
      }

      // 构建WHERE子句
      const whereClause = conditions.length > 0 
        ? `WHERE ${conditions.join(' AND ')}` 
        : '';

      // 查询总数 - 使用LEFT JOIN连接projects表
      const countQuery = `
        SELECT COUNT(*) as count 
        FROM prompt_logs l
        LEFT JOIN projects p ON l.project_id = p.id
        ${whereClause}
      `;
      
      const countResult: any = await new Promise((resolve, reject) => {
        this.db.get(countQuery, queryParams, (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });
      const total = countResult ? countResult.count : 0;

      // 查询数据 - 使用LEFT JOIN连接projects表
      const dataQuery = `
        SELECT l.* 
        FROM prompt_logs l
        LEFT JOIN projects p ON l.project_id = p.id
        ${whereClause}
        ORDER BY l.created_at DESC
        LIMIT ? OFFSET ?
      `;
      
      queryParams.push(limit);
      queryParams.push(offset);

      const logs: LogItem[] = await new Promise((resolve, reject) => {
        this.db.all(dataQuery, queryParams, (err, rows) => {
          if (err) reject(err);
          else resolve(rows as LogItem[]);
        });
      });

      return { logs, total };
      
    } catch (error) {
      console.error('查询日志列表失败:', error);
      throw error;
    }
  }

  /**
   * 根据ID查询日志
   */
  async findById(id: number): Promise<LogItem | null> {
    try {
      const log: LogItem | undefined = await new Promise((resolve, reject) => {
        this.db.get(
          'SELECT * FROM prompt_logs WHERE id = ?',
          [id],
          (err, row) => {
            if (err) reject(err);
            else resolve(row as LogItem | undefined);
          }
        );
      });

      return log || null;
    } catch (error) {
      console.error(`查询日志ID=${id}失败:`, error);
      throw error;
    }
  }

  /**
   * 根据请求ID查询日志
   */
  async findByRequestId(requestId: string): Promise<LogItem | null> {
    return new Promise((resolve, reject) => {
      this.db.get(
        `SELECT * FROM prompt_logs WHERE request_id = ?`,
        [requestId],
        (err, row) => {
          if (err) {
            reject(err);
          } else {
            resolve(row as LogItem || null);
          }
        }
      );
    });
  }

  /**
   * 根据消息ID查找日志记录
   * 用于流式输出时查找相关日志
   */
  async findByMessageId(messageId: string): Promise<LogItem[]> {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT * FROM prompt_logs WHERE JSON_EXTRACT(raw_response, '$.messageId') = ? OR prompt_content LIKE ?`,
        [messageId, `%${messageId}%`],
        (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows as LogItem[] || []);
          }
        }
      );
    });
  }

  /**
   * 更新日志记录
   */
  async updateByRequestId(
    requestId: string,
    data: {
      responseContent?: string;
      rawResponse?: string;
      tokenUsage?: number;
      tokenUsageDetail?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
      };
      status?: 'success' | 'error';
      errorMessage?: string;
    }
  ): Promise<void> {
    try {
      const updateFields: string[] = [];
      const values: any[] = [];

      // 构建更新字段
      if (data.responseContent !== undefined) {
        updateFields.push('response_content = ?');
        values.push(data.responseContent);
      }

      if (data.rawResponse !== undefined) {
        updateFields.push('raw_response = ?');
        values.push(data.rawResponse);
      }

      if (data.tokenUsage !== undefined) {
        updateFields.push('total_tokens = ?');
        values.push(data.tokenUsage);
      }

      if (data.tokenUsageDetail) {
        if (data.tokenUsageDetail.promptTokens !== undefined) {
          updateFields.push('prompt_tokens = ?');
          values.push(data.tokenUsageDetail.promptTokens);
        }
        
        if (data.tokenUsageDetail.completionTokens !== undefined) {
          updateFields.push('completion_tokens = ?');
          values.push(data.tokenUsageDetail.completionTokens);
        }
      }

      if (data.status) {
        updateFields.push('status = ?');
        values.push(data.status);
      }

      if (data.errorMessage !== undefined) {
        updateFields.push('error_message = ?');
        values.push(data.errorMessage);
      }

      // 如果没有需要更新的字段，直接返回
      if (updateFields.length === 0) {
        return;
      }

      // 添加请求ID
      values.push(requestId);

      // 执行更新
      await new Promise<void>((resolve, reject) => {
        this.db.run(
          `UPDATE prompt_logs SET ${updateFields.join(', ')} WHERE request_id = ?`,
          values,
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      console.log(`成功更新请求ID=${requestId}的日志记录`);
    } catch (error) {
      console.error(`更新请求ID=${requestId}的日志记录失败:`, error);
      throw error;
    }
  }

  /**
   * 获取某个字段的所有不同值
   */
  async getDistinctValues(field: string): Promise<string[]> {
    try {
      const results: any[] = await new Promise((resolve, reject) => {
        this.db.all(
          `SELECT DISTINCT ${field} FROM prompt_logs WHERE ${field} IS NOT NULL ORDER BY ${field}`,
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
          }
        );
      });
      
      // 提取字段值并过滤掉null和undefined
      return results
        .map(row => row[field])
        .filter(value => value !== null && value !== undefined);
    } catch (error) {
      console.error(`获取${field}的不同值失败:`, error);
      throw error;
    }
  }

  private async columnExists(db: Database, tableName: string, columnName: string): Promise<boolean> {
    try {
      const columns: any[] = await new Promise((resolve, reject) => {
        db.all(
          `PRAGMA table_info(${tableName})`,
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
          }
        );
      });
      
      // 在结果中查找指定的列名
      return columns.some(col => col.name === columnName);
    } catch (error) {
      console.error(`检查列 ${columnName} 是否存在时出错:`, error);
      return false;
    }
  }

  private async alterTable(db: Database) {
    try {
      // 检查 request_type 列是否存在
      const exists = await this.columnExists(db, 'prompt_logs', 'request_type');
      if (!exists) {
        await db.run(
          "ALTER TABLE prompt_logs ADD COLUMN request_type TEXT NOT NULL DEFAULT 'feedback'"
        );
      }
    } catch (error) {
      console.error('更新表结构失败:', error);
      throw error;
    }
  }
} 