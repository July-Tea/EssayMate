import { Database } from 'sqlite3';
import { ProjectStatus } from '../types/common';

export interface ExampleEssay {
  id: number;
  projectId: number;
  versionNumber: number;
  exampleContent: string;
  improvement?: string;
  wordCount: number;
  status: ProjectStatus;
  isDel: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExampleEssayCreate {
  projectId: number;
  versionNumber: number;
  exampleContent: string;
  improvement?: string;
  wordCount: number;
  status: ProjectStatus;
}

export class ExampleEssayModel {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  async create(example: ExampleEssayCreate): Promise<ExampleEssay> {
    const now = new Date();
    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT INTO example_essays (
          project_id, version_number, example_content, improvement, word_count, status,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          example.projectId,
          example.versionNumber,
          example.exampleContent,
          example.improvement || null,
          example.wordCount,
          example.status,
          now.toISOString(),
          now.toISOString()
        ],
        function(err) {
          if (err) return reject(err);
          
          resolve({
            id: this.lastID,
            projectId: example.projectId,
            versionNumber: example.versionNumber,
            exampleContent: example.exampleContent,
            improvement: example.improvement,
            wordCount: example.wordCount,
            status: example.status,
            isDel: 0,
            createdAt: now,
            updatedAt: now
          });
        }
      );
    });
  }

  async findByProjectId(projectId: number): Promise<ExampleEssay[]> {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT * FROM example_essays 
         WHERE project_id = ? AND is_del = 0 
         ORDER BY version_number ASC`,
        [projectId],
        (err, rows: any[]) => {
          if (err) return reject(err);
          
          const examples = rows.map(row => {
            // 处理内容字段
            let exampleContent = row.example_content;
            if (typeof exampleContent === 'string') {
              // 将纯文本内容按双换行符分割为段落数组
              exampleContent = exampleContent.split('\n\n').filter(p => p.trim() !== '');
            }
            
            return {
              id: row.id,
              projectId: row.project_id,
              versionNumber: row.version_number,
              exampleContent: exampleContent,
              improvement: row.improvement,
              wordCount: row.word_count,
              status: row.status as ProjectStatus,
              isDel: row.is_del,
              createdAt: new Date(row.created_at),
              updatedAt: new Date(row.updated_at)
            };
          });
          
          resolve(examples);
        }
      );
    });
  }

  async findByProjectIdAndVersion(projectId: number, versionNumber: number): Promise<ExampleEssay | null> {
    return new Promise((resolve, reject) => {
      this.db.get(
        `SELECT * FROM example_essays 
         WHERE project_id = ? AND version_number = ? AND is_del = 0`,
        [projectId, versionNumber],
        (err, row: any) => {
          if (err) return reject(err);
          if (!row) return resolve(null);
          
          // 处理内容字段
          let exampleContent = row.example_content;
          if (typeof exampleContent === 'string') {
            // 将纯文本内容按双换行符分割为段落数组
            exampleContent = exampleContent.split('\n\n').filter(p => p.trim() !== '');
          }
          
          resolve({
            id: row.id,
            projectId: row.project_id,
            versionNumber: row.version_number,
            exampleContent: exampleContent,
            improvement: row.improvement,
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
        'UPDATE example_essays SET is_del = 1, updated_at = ? WHERE project_id = ?',
        [new Date().toISOString(), projectId],
        (err) => {
          if (err) return reject(err);
          resolve();
        }
      );
    });
  }

  async updateStatus(projectId: number, versionNumber: number, status: ProjectStatus): Promise<void> {
    return new Promise((resolve, reject) => {
      const now = new Date().toISOString();
      this.db.run(
        'UPDATE example_essays SET status = ?, updated_at = ? WHERE project_id = ? AND version_number = ? AND is_del = 0',
        [status, now, projectId, versionNumber],
        (err) => {
          if (err) return reject(err);
          resolve();
        }
      );
    });
  }

  async searchByKeyword(projectId: number, keyword: string): Promise<ExampleEssay[]> {
    return new Promise((resolve, reject) => {
      const searchPattern = `%${keyword}%`;
      this.db.all(
        `SELECT * FROM example_essays 
         WHERE project_id = ? AND is_del = 0 
         AND (example_content LIKE ? OR version_number LIKE ?)
         ORDER BY version_number ASC`,
        [projectId, searchPattern, searchPattern],
        (err, rows: any[]) => {
          if (err) return reject(err);
          
          const examples = rows.map(row => {
            // 处理内容字段
            let exampleContent = row.example_content;
            if (typeof exampleContent === 'string') {
              // 将纯文本内容按双换行符分割为段落数组
              exampleContent = exampleContent.split('\n\n').filter(p => p.trim() !== '');
            }
            
            return {
              id: row.id,
              projectId: row.project_id,
              versionNumber: row.version_number,
              exampleContent: exampleContent,
              improvement: row.improvement,
              wordCount: row.word_count,
              status: row.status as ProjectStatus,
              isDel: row.is_del,
              createdAt: new Date(row.created_at),
              updatedAt: new Date(row.updated_at)
            };
          });
          
          resolve(examples);
        }
      );
    });
  }
} 