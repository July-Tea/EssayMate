/**
 * 日志工具
 * 提供统一的日志记录功能，支持不同日志级别
 */

// 日志级别枚举
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

// 默认日志级别 (可通过环境变量配置)
const DEFAULT_LOG_LEVEL = LogLevel.INFO;

// 当前日志级别
let currentLogLevel = process.env.LOG_LEVEL
  ? parseInt(process.env.LOG_LEVEL, 10)
  : DEFAULT_LOG_LEVEL;

/**
 * 日志记录器
 */
class Logger {
  /**
   * 设置日志级别
   * @param level 日志级别
   */
  setLogLevel(level: LogLevel) {
    currentLogLevel = level;
  }

  /**
   * 获取当前日志级别
   * @returns 当前日志级别
   */
  getLogLevel(): LogLevel {
    return currentLogLevel;
  }

  /**
   * 记录调试级别日志
   * @param message 日志消息
   * @param args 其他参数
   */
  debug(message: string, ...args: any[]) {
    if (currentLogLevel <= LogLevel.DEBUG) {
      console.debug(`[DEBUG] ${new Date().toISOString()} - ${message}`, ...args);
    }
  }

  /**
   * 记录信息级别日志
   * @param message 日志消息
   * @param args 其他参数
   */
  info(message: string, ...args: any[]) {
    if (currentLogLevel <= LogLevel.INFO) {
      console.info(`[INFO] ${new Date().toISOString()} - ${message}`, ...args);
    }
  }

  /**
   * 记录警告级别日志
   * @param message 日志消息
   * @param args 其他参数
   */
  warn(message: string, ...args: any[]) {
    if (currentLogLevel <= LogLevel.WARN) {
      console.warn(`[WARN] ${new Date().toISOString()} - ${message}`, ...args);
    }
  }

  /**
   * 记录错误级别日志
   * @param message 日志消息
   * @param args 其他参数
   */
  error(message: string, ...args: any[]) {
    if (currentLogLevel <= LogLevel.ERROR) {
      console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, ...args);
    }
  }

  /**
   * 记录AI操作相关的日志
   * 包括模型名称、请求类型、考试类型等信息
   * @param model 模型名称
   * @param examType 考试类型
   * @param taskType 任务类型
   * @param operation 操作类型
   * @param message 日志消息
   * @param data 其他数据
   */
  ai(model: string, examType: string, taskType: string, operation: string, message: string, data?: any) {
    if (currentLogLevel <= LogLevel.INFO) {
      const logPrefix = `[AI:${model}:${examType}:${taskType}:${operation}]`;
      console.info(`${logPrefix} ${new Date().toISOString()} - ${message}`, data ? data : '');
    }
  }
}

// 创建单例
const logger = new Logger();

export default logger; 