import { AppDataSource } from '../data-source';
import { GeneralSettings } from '../models/GeneralSettings';
import { Repository } from 'typeorm';

/**
 * 通用设置服务
 * 提供 key-value 形式的设置管理
 */
export class GeneralSettingsService {
  private settingsRepository: Repository<GeneralSettings>;

  constructor() {
    this.settingsRepository = AppDataSource.getRepository(GeneralSettings);
  }

  /**
   * 获取设置值
   * @param key 设置键名
   * @param defaultValue 默认值
   * @returns 设置值
   */
  async getSetting<T = string>(key: string, defaultValue?: T): Promise<T> {
    try {
      const setting = await this.settingsRepository.findOne({ where: { key } });
      
      if (!setting) {
        return defaultValue as T;
      }

      // 尝试解析JSON，如果失败则返回字符串
      try {
        return JSON.parse(setting.value) as T;
      } catch {
        return setting.value as T;
      }
    } catch (error) {
      console.error(`获取设置 ${key} 失败:`, error);
      return defaultValue as T;
    }
  }

  /**
   * 设置值
   * @param key 设置键名
   * @param value 设置值
   * @param description 设置描述
   */
  async setSetting<T>(key: string, value: T, description?: string): Promise<void> {
    try {
      // 查找现有设置
      let setting = await this.settingsRepository.findOne({ where: { key } });
      
      if (!setting) {
        // 创建新设置
        setting = new GeneralSettings();
        setting.key = key;
      }
      
      // 设置值（如果是对象或数组，转换为JSON字符串）
      if (typeof value === 'object' && value !== null) {
        setting.value = JSON.stringify(value);
      } else {
        setting.value = String(value);
      }
      
      if (description) {
        setting.description = description;
      }
      
      await this.settingsRepository.save(setting);
    } catch (error) {
      console.error(`设置 ${key} 失败:`, error);
      throw error;
    }
  }

  /**
   * 获取多个设置
   * @param keys 设置键名数组
   * @returns 设置键值对
   */
  async getSettings(keys: string[]): Promise<Record<string, any>> {
    try {
      const settings = await this.settingsRepository.find({
        where: keys.map(key => ({ key }))
      });
      
      const result: Record<string, any> = {};
      
      for (const setting of settings) {
        try {
          result[setting.key] = JSON.parse(setting.value);
        } catch {
          result[setting.key] = setting.value;
        }
      }
      
      return result;
    } catch (error) {
      console.error('获取多个设置失败:', error);
      return {};
    }
  }

  /**
   * 批量设置
   * @param settings 设置键值对
   */
  async setSettings(settings: Record<string, any>): Promise<void> {
    try {
      for (const [key, value] of Object.entries(settings)) {
        await this.setSetting(key, value);
      }
    } catch (error) {
      console.error('批量设置失败:', error);
      throw error;
    }
  }

  /**
   * 删除设置
   * @param key 设置键名
   */
  async deleteSetting(key: string): Promise<void> {
    try {
      await this.settingsRepository.delete({ key });
    } catch (error) {
      console.error(`删除设置 ${key} 失败:`, error);
      throw error;
    }
  }

  /**
   * 获取所有设置
   * @returns 所有设置的键值对
   */
  async getAllSettings(): Promise<Record<string, any>> {
    try {
      const settings = await this.settingsRepository.find();
      const result: Record<string, any> = {};
      
      for (const setting of settings) {
        try {
          result[setting.key] = JSON.parse(setting.value);
        } catch {
          result[setting.key] = setting.value;
        }
      }
      
      return result;
    } catch (error) {
      console.error('获取所有设置失败:', error);
      return {};
    }
  }

  /**
   * 获取最大并发任务数
   * @returns 最大并发任务数
   */
  async getMaxConcurrentTasks(): Promise<number> {
    return await this.getSetting('maxConcurrentTasks', 1);
  }

  /**
   * 设置最大并发任务数
   * @param value 最大并发任务数
   */
  async setMaxConcurrentTasks(value: number): Promise<void> {
    if (value < 1 || value > 20) {
      throw new Error('最大并发任务数必须在1-20之间');
    }
    
    await this.setSetting('maxConcurrentTasks', value, '批改时同时执行的最大任务数量');
  }

  /**
   * 初始化默认设置
   */
  async initializeDefaultSettings(): Promise<void> {
    try {
      // 检查是否已有设置
      const existingSettings = await this.settingsRepository.count();
      
      if (existingSettings === 0) {
        // 初始化默认设置
        await this.setMaxConcurrentTasks(1);
        console.log('已初始化默认通用设置');
      }
    } catch (error) {
      console.error('初始化默认设置失败:', error);
    }
  }
}
