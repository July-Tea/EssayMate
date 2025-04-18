import { Database } from 'sqlite3';
import { ProjectStatus } from '../types/common';

export interface Project {
  id: number;
  title: string;
  prompt: string;
  examType: string;
  category: string;
  targetScore?: string;
  currentVersion: number;
  status: ProjectStatus;
  totalVersions: number;
  chartImage?: string;
  isDel: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectCreate {
  title: string;
  prompt: string;
  examType: string;
  category: string;
  targetScore?: string;
  chartImage?: string;
  content?: string;
}

export interface ProjectUpdate {
  title?: string;
  prompt?: string;
  status?: ProjectStatus;
  currentVersion?: number;
  totalVersions?: number;
  chartImage?: string;
}

export class ProjectModel {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  async create(project: ProjectCreate): Promise<Project> {
    const now = new Date();
    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT INTO projects (
          title, prompt, exam_type, category, target_score, 
          current_version, status, total_versions, chart_image,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 1, ?, 1, ?, ?, ?)`,
        [
          project.title,
          project.prompt,
          project.examType,
          project.category,
          project.targetScore || null,
          ProjectStatus.DRAFT,
          project.chartImage || null,
          now.toISOString(),
          now.toISOString()
        ],
        function(err) {
          if (err) return reject(err);
          
          resolve({
            id: this.lastID,
            title: project.title,
            prompt: project.prompt,
            examType: project.examType,
            category: project.category,
            targetScore: project.targetScore || undefined,
            currentVersion: 1,
            status: ProjectStatus.DRAFT,
            totalVersions: 1,
            chartImage: project.chartImage,
            isDel: 0,
            createdAt: now,
            updatedAt: now
          });
        }
      );
    });
  }

  async update(id: number, project: ProjectUpdate): Promise<Project> {
    const now = new Date();
    const updateFields: string[] = [];
    const updateValues: any[] = [];

    if (project.title !== undefined) {
      updateFields.push('title = ?');
      updateValues.push(project.title);
    }
    
    if (project.prompt !== undefined) {
      updateFields.push('prompt = ?');
      updateValues.push(project.prompt);
    }
    
    if (project.status !== undefined) {
      updateFields.push('status = ?');
      updateValues.push(project.status);
    }
    
    if (project.currentVersion !== undefined) {
      updateFields.push('current_version = ?');
      updateValues.push(project.currentVersion);
    }
    
    if (project.totalVersions !== undefined) {
      updateFields.push('total_versions = ?');
      updateValues.push(project.totalVersions);
    }
    
    if (project.chartImage !== undefined) {
      updateFields.push('chart_image = ?');
      updateValues.push(project.chartImage);
    }
    
    updateFields.push('updated_at = ?');
    updateValues.push(now.toISOString());
    
    updateValues.push(id);

    return new Promise((resolve, reject) => {
      this.db.run(
        `UPDATE projects SET ${updateFields.join(', ')} WHERE id = ?`,
        updateValues,
        async (err) => {
          if (err) return reject(err);
          
          const updatedProject = await this.findById(id);
          if (!updatedProject) {
            return reject(new Error('更新项目后无法找到该项目'));
          }
          
          resolve(updatedProject);
        }
      );
    });
  }

  async delete(id: number): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(
        'UPDATE projects SET is_del = 1, updated_at = ? WHERE id = ?',
        [new Date().toISOString(), id],
        (err) => {
          if (err) return reject(err);
          resolve();
        }
      );
    });
  }

  async findById(id: number): Promise<Project | null> {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT * FROM projects WHERE id = ? AND is_del = 0',
        [id],
        (err, row: any) => {
          if (err) return reject(err);
          if (!row) return resolve(null);
          
          resolve({
            id: row.id,
            title: row.title,
            prompt: row.prompt,
            examType: row.exam_type,
            category: row.category,
            targetScore: row.target_score,
            currentVersion: row.current_version,
            status: row.status as ProjectStatus,
            totalVersions: row.total_versions,
            chartImage: row.chart_image,
            isDel: row.is_del,
            createdAt: new Date(row.created_at),
            updatedAt: new Date(row.updated_at)
          });
        }
      );
    });
  }

  async findAll(): Promise<Project[]> {
    return new Promise((resolve, reject) => {
      this.db.all(
        'SELECT * FROM projects WHERE is_del = 0 ORDER BY updated_at DESC',
        (err, rows: any[]) => {
          if (err) return reject(err);
          
          const projects = rows.map(row => ({
            id: row.id,
            title: row.title,
            prompt: row.prompt,
            examType: row.exam_type,
            category: row.category,
            targetScore: row.target_score,
            currentVersion: row.current_version,
            status: row.status as ProjectStatus,
            totalVersions: row.total_versions,
            chartImage: row.chart_image,
            isDel: row.is_del,
            createdAt: new Date(row.created_at),
            updatedAt: new Date(row.updated_at)
          }));
          
          resolve(projects);
        }
      );
    });
  }
}