import { Router } from 'express';
import { ConfigService } from '../services/config/ConfigService';
import { ApiError } from '../middleware/errorHandler';
import { ApiResponse, AIConfig } from '../types/api';
import express from 'express';
import { AppDataSource, getDatabaseConnection } from '../data-source';
import { Config } from '../models/Config';

const router = Router();
const configService = new ConfigService();

// 获取当前活动配置
router.get('/active', async (req, res, next) => {
  try {
    const config = await configService.getActiveConfig();
    const response: ApiResponse<any> = {
      success: true,
      data: config ? {
        id: config.id,
        model: config.model || '',
        apiKey: config.apiKey || '',
        modelConfigs: config.modelConfigs || {},
        is_active: config.is_active,
        updated_at: config.updated_at
      } : null
    };
    res.json(response);
  } catch (error) {
    console.error('获取活动配置失败:', error);
    if (error instanceof ApiError) {
      next(error);
    } else {
      next(new ApiError('获取活动配置失败', 'CONFIG_FETCH_ERROR', 500));
    }
  }
});

// 获取所有配置
router.get('/', async (req, res, next) => {
  try {
    const configs = await configService.getAllConfigs();
    const response: ApiResponse<any> = {
      success: true,
      data: configs.map(config => ({
        id: config.id,
        model: config.model,
        apiKey: config.apiKey,
        modelConfigs: config.modelConfigs || {},
        is_active: config.is_active,
        updated_at: config.updated_at
      }))
    };
    res.json(response);
  } catch (error) {
    console.error('获取所有配置失败:', error);
    if (error instanceof ApiError) {
      next(error);
    } else {
      next(new ApiError('获取所有配置失败', 'CONFIG_FETCH_ERROR', 500));
    }
  }
});

// 获取指定模型的配置
router.get('/:model', async (req, res, next) => {
  try {
    const { model } = req.params;
    const config = await configService.getConfigByModel(model);
    
    if (!config) {
      throw new ApiError('未找到该模型的配置', 'CONFIG_NOT_FOUND', 404);
    }
    
    const response: ApiResponse<any> = {
      success: true,
      data: {
        id: config.id,
        model: config.model,
        apiKey: config.apiKey,
        modelConfigs: config.modelConfigs || {},
        is_active: config.is_active,
        updated_at: config.updated_at
      }
    };
    res.json(response);
  } catch (error) {
    console.error('获取模型配置失败:', error);
    if (error instanceof ApiError) {
      next(error);
    } else {
      next(new ApiError('获取模型配置失败', 'CONFIG_FETCH_ERROR', 500));
    }
  }
});

// 保存新配置
router.post('/', async (req, res, next) => {
  try {
    const aiConfig: AIConfig = req.body;
    
    if (!aiConfig.model || !aiConfig.apiKey) {
      throw new ApiError('模型和API密钥不能为空', 'INVALID_PARAMS', 400);
    }

    const config = await configService.saveConfig(aiConfig);
    
    const response: ApiResponse<any> = {
      success: true,
      data: {
        id: config.id,
        model: config.model,
        apiKey: config.apiKey,
        modelConfigs: config.modelConfigs || {},
        is_active: config.is_active,
        updated_at: config.updated_at
      }
    };
    res.json(response);
  } catch (error) {
    console.error('保存配置失败:', error);
    if (error instanceof ApiError) {
      next(error);
    } else {
      next(new ApiError('保存配置失败', 'CONFIG_SAVE_ERROR', 500));
    }
  }
});

// 激活配置
router.post('/activate/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const config = await configService.activateConfig(Number(id));
    
    const response: ApiResponse<any> = {
      success: true,
      data: {
        id: config.id,
        model: config.model,
        apiKey: config.apiKey,
        modelConfigs: config.modelConfigs || {},
        is_active: config.is_active,
        updated_at: config.updated_at
      }
    };
    res.json(response);
  } catch (error) {
    console.error('激活配置失败:', error);
    if (error instanceof ApiError) {
      next(error);
    } else {
      next(new ApiError('激活配置失败', 'CONFIG_ACTIVATION_ERROR', 500));
    }
  }
});

// 删除配置
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    await configService.deleteConfig(Number(id));
    
    const response: ApiResponse<any> = {
      success: true,
      data: { message: '配置已成功删除' }
    };
    res.json(response);
  } catch (error) {
    console.error('删除配置失败:', error);
    if (error instanceof ApiError) {
      next(error);
    } else {
      next(new ApiError('删除配置失败', 'CONFIG_DELETE_ERROR', 500));
    }
  }
});

// 新增：获取数据库表结构和数据
router.get('/database/tables', async (req, res) => {
  try {
    const db = getDatabaseConnection();
    
    // 获取所有表名
    const tablesResult = await new Promise<any[]>((resolve, reject) => {
      db.all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'", (err, tables) => {
        if (err) reject(err);
        else resolve(tables);
      });
    });
    
    const tableNames = tablesResult.map(t => t.name);
    const tablesData: Record<string, any> = {};
    
    // 获取每个表的数据和结构
    for (const tableName of tableNames) {
      // 获取表结构（列信息）
      const tableInfo = await new Promise<any[]>((resolve, reject) => {
        db.all(`PRAGMA table_info(${tableName})`, (err, columns) => {
          if (err) reject(err);
          else resolve(columns);
        });
      });
      
      // 获取表数据
      const tableData = await new Promise<any[]>((resolve, reject) => {
        db.all(`SELECT * FROM ${tableName} LIMIT 1000`, (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });
      
      tablesData[tableName] = {
        columns: tableInfo,
        data: tableData
      };
    }
    
    res.json({
      success: true,
      tables: tableNames,
      tablesData
    });
  } catch (error) {
    console.error('获取数据库信息失败:', error);
    res.status(500).json({
      success: false,
      message: '获取数据库信息失败',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router;