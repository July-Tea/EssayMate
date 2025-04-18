import { Database } from 'sqlite3';
import { ProjectStatus } from '../types/common';

export interface EssayVersion {
  id: number;
  projectId: number;
  versionNumber: number;
  content: string | string[];
  wordCount: number;
  status: ProjectStatus;
  isDel: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface EssayVersionCreate {
  projectId: number;
  versionNumber: number;
  content: string;
  wordCount: number;
  status: ProjectStatus;
}

export class EssayVersionModel {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  async create(version: EssayVersionCreate): Promise<EssayVersion> {
    const now = new Date();
    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT INTO essay_versions (
          project_id, version_number, content, word_count, status,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          version.projectId,
          version.versionNumber,
          version.content,
          version.wordCount,
          version.status,
          now.toISOString(),
          now.toISOString()
        ],
        function(err) {
          if (err) return reject(err);
          
          resolve({
            id: this.lastID,
            projectId: version.projectId,
            versionNumber: version.versionNumber,
            content: version.content,
            wordCount: version.wordCount,
            status: version.status,
            isDel: 0,
            createdAt: now,
            updatedAt: now
          });
        }
      );
    });
  }

  async findByProjectId(projectId: number): Promise<EssayVersion[]> {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT * FROM essay_versions 
         WHERE project_id = ? AND is_del = 0 
         ORDER BY version_number ASC`,
        [projectId],
        (err, rows: any[]) => {
          if (err) return reject(err);
          
          const versions = rows.map(row => {
            // 处理内容字段
            let content = row.content;
            if (typeof content === 'string') {
              // 将纯文本内容按双换行符分割为段落数组
              content = content.split('\n\n').filter(p => p.trim() !== '');
            }
            
            return {
              id: row.id,
              projectId: row.project_id,
              versionNumber: row.version_number,
              content: content,
              wordCount: row.word_count,
              status: row.status as ProjectStatus,
              isDel: row.is_del,
              createdAt: new Date(row.created_at),
              updatedAt: new Date(row.updated_at)
            };
          });
          
          resolve(versions);
        }
      );
    });
  }

  async findByProjectIdAndVersion(projectId: number, versionNumber: number): Promise<EssayVersion | null> {
    return new Promise((resolve, reject) => {
      this.db.get(
        `SELECT * FROM essay_versions 
         WHERE project_id = ? AND version_number = ? AND is_del = 0`,
        [projectId, versionNumber],
        (err, row: any) => {
          if (err) return reject(err);
          if (!row) return resolve(null);
          
          // 处理内容字段
          let content = row.content;
          if (typeof content === 'string') {
            // 将纯文本内容按双换行符分割为段落数组
            content = content.split('\n\n').filter(p => p.trim() !== '');
          }
          
          resolve({
            id: row.id,
            projectId: row.project_id,
            versionNumber: row.version_number,
            content: content,
            wordCount: row.word_count,
            status: row.status as ProjectStatus,
            isDel: row.is_del,
            createdAt: new Date(row.created_at),
            updatedAt: new Date(row.updated_at)
          });
        }
      );
    });
  }

  async getLatestVersion(projectId: number): Promise<EssayVersion | null> {
    return new Promise((resolve, reject) => {
      this.db.get(
        `SELECT * FROM essay_versions 
         WHERE project_id = ? AND is_del = 0 
         ORDER BY version_number DESC 
         LIMIT 1`,
        [projectId],
        (err, row: any) => {
          if (err) return reject(err);
          if (!row) return resolve(null);
          
          // 处理内容字段
          let content = row.content;
          if (typeof content === 'string') {
            // 将纯文本内容按双换行符分割为段落数组
            content = content.split('\n\n').filter(p => p.trim() !== '');
          }
          
          resolve({
            id: row.id,
            projectId: row.project_id,
            versionNumber: row.version_number,
            content: content,
            wordCount: row.word_count,
            status: row.status as ProjectStatus,
            isDel: row.is_del,
            createdAt: new Date(row.created_at),
            updatedAt: new Date(row.updated_at)
          });
        }
      );
    });
  }

  async deleteByProjectId(projectId: number): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(
        'UPDATE essay_versions SET is_del = 1, updated_at = ? WHERE project_id = ?',
        [new Date().toISOString(), projectId],
        (err) => {
          if (err) return reject(err);
          resolve();
        }
      );
    });
  }

  /**
   * 更新essay_version的状态
   * @param projectId 项目ID
   * @param versionNumber 版本号
   * @param status 新状态
   */
  async updateStatus(projectId: number, versionNumber: number, status: ProjectStatus): Promise<void> {
    return new Promise((resolve, reject) => {
      const now = new Date().toISOString();
      this.db.run(
        'UPDATE essay_versions SET status = ?, updated_at = ? WHERE project_id = ? AND version_number = ? AND is_del = 0',
        [status, now, projectId, versionNumber],
        (err) => {
          if (err) return reject(err);
          resolve();
        }
      );
    });
  }

  /**
   * 通过版本号更新essay_version的状态
   * @param projectId 项目ID
   * @param versionNumber 版本号
   * @param status 新状态
   */
  async updateStatusByVersionNumber(projectId: number, versionNumber: number, status: ProjectStatus): Promise<void> {
    return this.updateStatus(projectId, versionNumber, status);
  }
} 