import { Request, Response } from 'express';
import { ExampleEssayModel, ExampleEssayCreate } from '../models/ExampleEssay';
import { getDatabaseConnection } from '../data-source';
import { ProjectStatus } from '../types/common';

// 创建范文控制器
export const exampleEssayController = {
  // 创建新范文
  async create(req: Request, res: Response) {
    try {
      const { 
        projectId, 
        versionNumber, 
        exampleContent, 
        wordCount 
      } = req.body;

      // 基本验证
      if (!projectId || !versionNumber || !exampleContent) {
        return res.status(400).json({ 
          success: false, 
          error: { 
            code: 'INVALID_DATA', 
            message: '缺少必要的参数' 
          } 
        });
      }

      // 创建范文模型实例
      const exampleEssayModel = new ExampleEssayModel(getDatabaseConnection());
      
      // 检查是否已存在相同projectId和版本号的范文
      const existingExample = await exampleEssayModel.findByProjectIdAndVersion(projectId, versionNumber);
      if (existingExample) {
        return res.status(400).json({ 
          success: false, 
          error: { 
            code: 'DUPLICATE_VERSION', 
            message: '该项目下已存在相同版本号的范文' 
          } 
        });
      }

      // 准备创建范文
      const exampleData: ExampleEssayCreate = {
        projectId,
        versionNumber,
        exampleContent,
        wordCount: wordCount || exampleContent.split(/\s+/).length, // 如果未提供字数，则计算
        status: ProjectStatus.DRAFT
      };

      // 创建范文
      const createdExample = await exampleEssayModel.create(exampleData);
      
      res.status(201).json({ 
        success: true, 
        data: createdExample 
      });
    } catch (error) {
      console.error('创建范文失败:', error);
      res.status(500).json({ 
        success: false, 
        error: { 
          code: 'SERVER_ERROR', 
          message: '服务器内部错误' 
        } 
      });
    }
  },

  // 获取项目的所有范文
  async getByProjectId(req: Request, res: Response) {
    try {
      const { projectId } = req.params;
      
      if (!projectId || isNaN(Number(projectId))) {
        return res.status(400).json({ 
          success: false, 
          error: { 
            code: 'INVALID_ID', 
            message: '无效的项目ID' 
          } 
        });
      }

      const exampleEssayModel = new ExampleEssayModel(getDatabaseConnection());
      const examples = await exampleEssayModel.findByProjectId(Number(projectId));
      
      res.json({ 
        success: true, 
        data: examples 
      });
    } catch (error) {
      console.error('获取范文列表失败:', error);
      res.status(500).json({ 
        success: false, 
        error: { 
          code: 'SERVER_ERROR', 
          message: '服务器内部错误' 
        } 
      });
    }
  },

  // 获取特定版本的范文
  async getByProjectIdAndVersion(req: Request, res: Response) {
    try {
      const { projectId, versionNumber } = req.params;
      
      if (!projectId || isNaN(Number(projectId)) || !versionNumber || isNaN(Number(versionNumber))) {
        return res.status(400).json({ 
          success: false, 
          error: { 
            code: 'INVALID_PARAMS', 
            message: '无效的项目ID或版本号' 
          } 
        });
      }

      const exampleEssayModel = new ExampleEssayModel(getDatabaseConnection());
      const example = await exampleEssayModel.findByProjectIdAndVersion(
        Number(projectId), 
        Number(versionNumber)
      );
      
      if (!example) {
        return res.status(404).json({ 
          success: false, 
          error: { 
            code: 'NOT_FOUND', 
            message: '未找到指定的范文' 
          } 
        });
      }
      
      res.json({ 
        success: true, 
        data: example 
      });
    } catch (error) {
      console.error('获取范文失败:', error);
      res.status(500).json({ 
        success: false, 
        error: { 
          code: 'SERVER_ERROR', 
          message: '服务器内部错误' 
        } 
      });
    }
  },

  // 删除特定项目的所有范文
  async deleteByProjectId(req: Request, res: Response) {
    try {
      const { projectId } = req.params;
      
      if (!projectId || isNaN(Number(projectId))) {
        return res.status(400).json({ 
          success: false, 
          error: { 
            code: 'INVALID_ID', 
            message: '无效的项目ID' 
          } 
        });
      }

      const exampleEssayModel = new ExampleEssayModel(getDatabaseConnection());
      await exampleEssayModel.deleteByProjectId(Number(projectId));
      
      res.json({ 
        success: true,
        message: '范文删除成功'
      });
    } catch (error) {
      console.error('删除范文失败:', error);
      res.status(500).json({ 
        success: false, 
        error: { 
          code: 'SERVER_ERROR', 
          message: '服务器内部错误' 
        } 
      });
    }
  },

  // 更新范文状态
  async updateStatus(req: Request, res: Response) {
    try {
      const { projectId, versionNumber } = req.params;
      const { status } = req.body;
      
      if (!projectId || isNaN(Number(projectId)) || !versionNumber || isNaN(Number(versionNumber))) {
        return res.status(400).json({ 
          success: false, 
          error: { 
            code: 'INVALID_PARAMS', 
            message: '无效的项目ID或版本号' 
          } 
        });
      }

      if (!status || !Object.values(ProjectStatus).includes(status as ProjectStatus)) {
        return res.status(400).json({ 
          success: false, 
          error: { 
            code: 'INVALID_STATUS', 
            message: '无效的状态值' 
          } 
        });
      }

      const exampleEssayModel = new ExampleEssayModel(getDatabaseConnection());
      
      // 验证范文是否存在
      const example = await exampleEssayModel.findByProjectIdAndVersion(
        Number(projectId), 
        Number(versionNumber)
      );
      
      if (!example) {
        return res.status(404).json({ 
          success: false, 
          error: { 
            code: 'NOT_FOUND', 
            message: '未找到指定的范文' 
          } 
        });
      }

      await exampleEssayModel.updateStatus(
        Number(projectId), 
        Number(versionNumber), 
        status as ProjectStatus
      );
      
      res.json({ 
        success: true,
        message: '范文状态更新成功'
      });
    } catch (error) {
      console.error('更新范文状态失败:', error);
      res.status(500).json({ 
        success: false, 
        error: { 
          code: 'SERVER_ERROR', 
          message: '服务器内部错误' 
        } 
      });
    }
  }
}; 