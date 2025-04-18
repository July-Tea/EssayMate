import { Request, Response } from 'express';
import { PromptLogModel } from '../models/PromptLog';
import { getDatabaseConnection } from '../data-source';

export class LogController {
  private logModel: PromptLogModel;
  
  constructor() {
    this.logModel = new PromptLogModel(getDatabaseConnection());
  }
  
  /**
   * 获取日志列表
   */
  async getLogs(req: Request, res: Response): Promise<void> {
    try {
      const limit = parseInt(req.query.limit as string, 10) || 20;
      const offset = parseInt(req.query.offset as string, 10) || 0;
      const serviceType = req.query.serviceType as string;
      const modelName = req.query.modelName as string;
      const requestType = req.query.requestType as string;
      const status = req.query.status as string;
      const projectId = req.query.projectId ? parseInt(req.query.projectId as string, 10) : undefined;
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
      
      // 处理项目是否已删除的查询参数
      let isProjectDeleted: boolean | undefined = undefined;
      if (req.query.isProjectDeleted !== undefined) {
        // 将字符串转换为布尔值
        isProjectDeleted = req.query.isProjectDeleted === 'true';
      }
      
      const { logs, total } = await this.logModel.findAll({
        limit,
        offset,
        serviceType,
        modelName,
        requestType,
        status,
        projectId,
        startDate,
        endDate,
        isProjectDeleted
      });
      
      res.json({
        logs,
        total
      });
    } catch (error) {
      console.error('获取日志列表失败:', error);
      res.status(500).json({
        success: false,
        message: '获取日志列表失败',
        error: (error as Error).message
      });
    }
  }
  
  /**
   * 获取服务类型列表
   */
  async getServiceTypes(req: Request, res: Response): Promise<void> {
    try {
      const serviceTypes = await this.logModel.getDistinctValues('service_type');
      res.json(serviceTypes);
    } catch (error) {
      console.error('获取服务类型列表失败:', error);
      res.status(500).json({
        success: false,
        message: '获取服务类型列表失败',
        error: (error as Error).message
      });
    }
  }
  
  /**
   * 获取模型名称列表
   */
  async getModelNames(req: Request, res: Response): Promise<void> {
    try {
      const modelNames = await this.logModel.getDistinctValues('model_name');
      res.json(modelNames);
    } catch (error) {
      console.error('获取模型名称列表失败:', error);
      res.status(500).json({
        success: false,
        message: '获取模型名称列表失败',
        error: (error as Error).message
      });
    }
  }
  
  /**
   * 获取日志详情
   */
  async getLogDetail(req: Request, res: Response): Promise<void> {
    try {
      const logId = parseInt(req.params.id, 10);
      
      if (isNaN(logId)) {
        res.status(400).json({
          success: false,
          message: '无效的日志ID'
        });
        return;
      }
      
      const log = await this.logModel.findById(logId);
      
      if (!log) {
        res.status(404).json({
          success: false,
          message: '日志不存在'
        });
        return;
      }
      
      res.json({
        success: true,
        data: log
      });
    } catch (error) {
      console.error('获取日志详情失败:', error);
      res.status(500).json({
        success: false,
        message: '获取日志详情失败',
        error: (error as Error).message
      });
    }
  }
  
  /**
   * 获取日志统计信息
   */
  async getLogStats(req: Request, res: Response): Promise<void> {
    try {
      const { logs } = await this.logModel.findAll({
        limit: 1000 // 设置一个合理的上限
      });
      
      // 按服务类型统计
      const statsByService = logs.reduce((acc: Record<string, any>, log) => {
        const serviceType = log.service_type || 'unknown';
        
        if (!acc[serviceType]) {
          acc[serviceType] = {
            total: 0,
            success: 0,
            failed: 0,
            avgDuration: 0,
            totalTokens: 0
          };
        }
        
        acc[serviceType].total += 1;
        if (log.status === 'success') {
          acc[serviceType].success += 1;
        } else {
          acc[serviceType].failed += 1;
        }
        
        acc[serviceType].avgDuration = 
          (acc[serviceType].avgDuration * (acc[serviceType].total - 1) + log.duration) / 
          acc[serviceType].total;
          
        acc[serviceType].totalTokens += log.total_tokens;
        
        return acc;
      }, {});
      
      // 按请求类型统计
      const statsByRequestType = logs.reduce((acc: Record<string, any>, log) => {
        const requestType = log.request_type || 'unknown';
        
        if (!acc[requestType]) {
          acc[requestType] = {
            total: 0,
            success: 0,
            failed: 0
          };
        }
        
        acc[requestType].total += 1;
        if (log.status === 'success') {
          acc[requestType].success += 1;
        } else {
          acc[requestType].failed += 1;
        }
        
        return acc;
      }, {});
      
      res.json({
        success: true,
        data: {
          total: logs.length,
          statsByService,
          statsByRequestType,
          // 最近的几条记录
          recentLogs: logs.slice(0, 10)
        }
      });
    } catch (error) {
      console.error('获取日志统计失败:', error);
      res.status(500).json({
        success: false,
        message: '获取日志统计失败',
        error: (error as Error).message
      });
    }
  }
} 