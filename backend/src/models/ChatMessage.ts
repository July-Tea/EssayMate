import { Database } from 'sqlite3';
import { getDatabaseConnection } from '../data-source';

export interface ChatMessage {
  id: number;
  project_id: number;
  version_number: number;
  session_id: string;
  parent_id?: string;
  message_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  status: 'sending' | 'sent' | 'error';
  error_message?: string;
  created_at: string;
}

export interface ChatQueryParams {
  projectId: number;
  versionNumber: number;
  sessionId?: string;
  limit?: number;
  offset?: number;
}

export class ChatMessageModel {
  private db: Database;

  constructor(db?: Database) {
    this.db = db || getDatabaseConnection();
    this.initTable();
  }

  private async initTable(): Promise<void> {
    return new Promise((resolve, reject) => {
      // 首先检查表是否已存在
      this.db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='chat_messages'", (err, row) => {
        if (err) {
          console.error('检查chat_messages表是否存在失败:', err);
          reject(err);
          return;
        }
        
        // 如果表已存在，直接返回
        if (row) {
          resolve();
          return;
        }
        
        // 表不存在，创建表
        this.db.run(`
          CREATE TABLE IF NOT EXISTS chat_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER NOT NULL,
            version_number INTEGER NOT NULL,
            session_id TEXT NOT NULL,
            parent_id TEXT,
            message_id TEXT NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            status TEXT NOT NULL,
            error_message TEXT,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
          )
        `, (err) => {
          if (err) {
            console.error('创建chat_messages表失败:', err);
            reject(err);
          } else {
            // 创建索引
            this.db.run(`
              CREATE INDEX IF NOT EXISTS idx_chat_messages_project 
              ON chat_messages(project_id, version_number)
            `, (indexErr) => {
              if (indexErr) {
                console.error('创建chat_messages索引失败:', indexErr);
                reject(indexErr);
              } else {
                this.db.run(`
                  CREATE INDEX IF NOT EXISTS idx_chat_messages_session 
                  ON chat_messages(session_id)
                `, (sessionIndexErr) => {
                  if (sessionIndexErr) {
                    console.error('创建session_id索引失败:', sessionIndexErr);
                    reject(sessionIndexErr);
                  } else {
                    resolve();
                  }
                });
              }
            });
          }
        });
      });
    });
  }

  async create(data: {
    projectId: number;
    versionNumber: number;
    sessionId: string;
    parentId?: string;
    messageId: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    status: 'sending' | 'sent' | 'error';
    errorMessage?: string;
  }): Promise<number> {
    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT INTO chat_messages (
          project_id, version_number, session_id, parent_id, message_id, 
          role, content, status, error_message, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
        [
          data.projectId,
          data.versionNumber,
          data.sessionId,
          data.parentId || null,
          data.messageId,
          data.role,
          data.content,
          data.status,
          data.errorMessage || null
        ],
        function(err) {
          if (err) {
            console.error('保存聊天消息失败:', err);
            reject(err);
          } else {
            resolve(this.lastID);
          }
        }
      );
    });
  }

  async update(messageId: string, data: {
    status: 'sending' | 'sent' | 'error';
    content?: string;
    errorMessage?: string;
  }): Promise<void> {
    const updateFields: string[] = [];
    const params: (string | null)[] = [];

    if (data.status) {
      updateFields.push('status = ?');
      params.push(data.status);
    }

    if (data.content !== undefined) {
      updateFields.push('content = ?');
      params.push(data.content);
    }

    if (data.errorMessage !== undefined) {
      updateFields.push('error_message = ?');
      params.push(data.errorMessage);
    }

    if (updateFields.length === 0) {
      return Promise.resolve();
    }

    params.push(messageId);

    return new Promise((resolve, reject) => {
      this.db.run(
        `UPDATE chat_messages SET ${updateFields.join(', ')} WHERE message_id = ?`,
        params,
        (err) => {
          if (err) {
            console.error('更新聊天消息失败:', err);
            reject(err);
          } else {
            resolve();
          }
        }
      );
    });
  }

  async getBySessionId(sessionId: string): Promise<ChatMessage[]> {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT * FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC`,
        [sessionId],
        (err, rows) => {
          if (err) {
            console.error('获取会话消息失败:', err);
            reject(err);
          } else {
            resolve(rows as ChatMessage[]);
          }
        }
      );
    });
  }

  async getByProjectAndVersion(params: ChatQueryParams): Promise<ChatMessage[]> {
    const { projectId, versionNumber, sessionId, limit = 100, offset = 0 } = params;
    
    const queryParams: (number | string)[] = [projectId, versionNumber];
    let query = `
      SELECT * FROM chat_messages 
      WHERE project_id = ? AND version_number = ?
    `;
    
    if (sessionId) {
      query += ` AND session_id = ?`;
      queryParams.push(sessionId);
    }
    
    query += ` ORDER BY created_at ASC LIMIT ? OFFSET ?`;
    queryParams.push(limit, offset);
    
    return new Promise((resolve, reject) => {
      this.db.all(query, queryParams, (err, rows) => {
        if (err) {
          console.error('获取项目版本聊天记录失败:', err);
          reject(err);
        } else {
          resolve(rows as ChatMessage[]);
        }
      });
    });
  }

  async deleteByMessageId(messageId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(
        `DELETE FROM chat_messages WHERE message_id = ?`,
        [messageId],
        (err) => {
          if (err) {
            console.error('删除聊天消息失败:', err);
            reject(err);
          } else {
            resolve();
          }
        }
      );
    });
  }

  async deleteBySessionId(sessionId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(
        `DELETE FROM chat_messages WHERE session_id = ?`,
        [sessionId],
        (err) => {
          if (err) {
            console.error('删除会话消息失败:', err);
            reject(err);
          } else {
            resolve();
          }
        }
      );
    });
  }

  async getChildMessages(parentId: string): Promise<ChatMessage[]> {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT * FROM chat_messages WHERE parent_id = ? ORDER BY created_at ASC`,
        [parentId],
        (err, rows) => {
          if (err) {
            console.error('获取子消息失败:', err);
            reject(err);
          } else {
            resolve(rows as ChatMessage[]);
          }
        }
      );
    });
  }
} 