import * as fs from 'fs';
import * as path from 'path';
import { PromptConfig } from './PromptTemplate';

/**
 * 提示词类型枚举
 */
export enum PromptType {
  FEEDBACK = 'feedback',    // 评分和反馈
  ANNOTATION = 'annotation', // 段落批注
  EXAMPLE = 'example',       // 范文生成
  EXAMPLE_ESSAY = 'example_essay',  // 范文生成（新版）
  CHAT = 'chat'             // AI对话
}

/**
 * 作文任务类型枚举
 */
export enum EssayTaskType {
  IELTS_TASK1 = 'task1',  // 雅思任务1
  IELTS_TASK2 = 'task2',  // 雅思任务2
  TOEFL = 'toefl',        // 托福
  GRE = 'gre',             // GRE
  INTEGRATED = 'integrated',
  INDEPENDENT = 'independent',
  ISSUE = 'issue',
  ARGUMENT = 'argument',
  GENERAL = 'general' // 通用类型
}

/**
 * 提示词管理器
 * 负责加载和管理不同模型、考试类型和任务的提示词模板
 */
export class PromptManager {
  // 提示词缓存
  private static promptCache: Map<string, PromptConfig> = new Map();
  
  /**
   * 获取提示词模板
   * @param model 模型名称
   * @param examType 考试类型
   * @param taskType 任务类型
   * @param promptType 提示词类型
   * @returns 提示词模板
   */
  static async getPrompt(
    model: string,
    examType: string,
    taskType: string,
    promptType: PromptType
  ): Promise<PromptConfig> {
    // 构建缓存键
    const cacheKey = `${model}:${examType}:${taskType}:${promptType}`;
    
    // 检查缓存中是否存在
    if (this.promptCache.has(cacheKey)) {
      console.debug(`[PromptManager] 使用缓存的提示词模板: ${cacheKey}`);
      return this.promptCache.get(cacheKey)!;
    }
    
    try {
      // 构建提示词模板路径
      let promptModule;
      
      try {
        // 根据模型类型选择对应的模板文件
        let templateIndex;
        
        if (model.toLowerCase() === 'doubao') {
          templateIndex = require('./DoubaoPromptTemplates');
          console.info(`[PromptManager] 加载豆包模板索引: DoubaoPromptTemplates`);
        } else if (model.toLowerCase() === 'kimi') {
          templateIndex = require('./KimiPromptTemplates');
          console.info(`[PromptManager] 加载Kimi模板索引: KimiPromptTemplates`);
        } else if (model.toLowerCase() === 'tongyi') {
          // 加载通义专用模板
          templateIndex = require('./TongyiPromptTemplates');
          console.info(`[PromptManager] 加载通义模板索引: TongyiPromptTemplates`);
        } else {
          // 默认使用豆包模板
          templateIndex = require('./DoubaoPromptTemplates');
        }
        
        // 根据参数确定模板名称
        let templateName = '';
        
        if (examType.toLowerCase() === 'ielts') {
          if (taskType.toLowerCase() === 'task1') {
            if (promptType === PromptType.FEEDBACK) {
              templateName = 'IELTSTask1Feedback';
            } else if (promptType === PromptType.ANNOTATION) {
              templateName = 'IELTSTask1Annotation';
            } else if (promptType === PromptType.EXAMPLE) {
              templateName = 'IELTSTask1Example';
            } else if (promptType === PromptType.EXAMPLE_ESSAY) {
              templateName = 'IELTSTask1Example';
            } else if (promptType === PromptType.CHAT) {
              templateName = 'IELTSTask1Chat';
            }
          } else if (taskType.toLowerCase() === 'task2') {
            if (promptType === PromptType.FEEDBACK) {
              templateName = 'IELTSTask2Feedback';
            } else if (promptType === PromptType.ANNOTATION) {
              templateName = 'IELTSTask2Annotation';
            } else if (promptType === PromptType.EXAMPLE) {
              templateName = 'IELTSTask2Example';
            } else if (promptType === PromptType.EXAMPLE_ESSAY) {
              templateName = 'IELTSTask2Example';
            } else if (promptType === PromptType.CHAT) {
              templateName = 'IELTSTask2Chat';
            }
          }
        } else if (examType.toLowerCase() === 'toefl') {
          if (promptType === PromptType.FEEDBACK) {
            templateName = 'TOEFLFeedback';
          } else if (promptType === PromptType.ANNOTATION) {
            templateName = 'TOEFLAnnotation';
          } else if (promptType === PromptType.EXAMPLE) {
            templateName = 'TOEFLExample';
          } else if (promptType === PromptType.EXAMPLE_ESSAY) {
            templateName = 'TOEFLExample';
          }
        }
        
        // 检查是否找到模板
        if (templateName && templateIndex[templateName]) {
          promptModule = templateIndex[templateName];
          console.info(`[PromptManager] 已从索引中加载模板: ${templateName} (${model})`);
        } else {
          // 否则尝试直接从文件导入
          const promptPath = path.join(
            __dirname,
            'models',
            model.toLowerCase(),
            examType.toLowerCase(),
            taskType.toLowerCase(),
            // 修正文件名映射，使用正确的文件扩展名(.ts而非.js)
            promptType === PromptType.EXAMPLE_ESSAY ? 'example.ts' : `${promptType}.ts`
          );
          
          console.info(`[PromptManager] 尝试从路径加载模板: ${promptPath}`);
          try {
            promptModule = require(promptPath);
            // 检查是否有默认导出或命名导出
            if (promptModule.default) {
              promptModule = promptModule.default;
            } else if (promptType === PromptType.EXAMPLE_ESSAY && promptModule.exampleEssayPrompt) {
              promptModule = promptModule.exampleEssayPrompt;
            }
          } catch (error) {
            console.error(`[PromptManager] 无法从路径加载模板: ${promptPath}, 错误: ${error}`);
            throw error;
          }
        }
      } catch (error) {
        console.error(`[PromptManager] 从索引加载模板失败: ${error}`);
        // 尝试直接从文件导入
        const promptPath = path.join(
          __dirname,
          'models',
          model.toLowerCase(),
          examType.toLowerCase(),
          taskType.toLowerCase(),
          // 修正文件名映射，使用正确的文件扩展名(.ts而非.js)
          promptType === PromptType.EXAMPLE_ESSAY ? 'example.ts' : `${promptType}.ts`
        );
        
        console.info(`[PromptManager] 尝试从路径加载模板: ${promptPath}`);
        try {
          promptModule = require(promptPath);
          // 检查是否有默认导出或命名导出
          if (promptModule.default) {
            promptModule = promptModule.default;
          } else if (promptType === PromptType.EXAMPLE_ESSAY && promptModule.exampleEssayPrompt) {
            promptModule = promptModule.exampleEssayPrompt;
          }
        } catch (error) {
          console.error(`[PromptManager] 无法从路径加载模板: ${promptPath}, 错误: ${error}`);
          throw error;
        }
      }
      
      // 缓存提示词模板
      this.promptCache.set(cacheKey, promptModule);
      return promptModule;
    } catch (error) {
      console.error(`[PromptManager] 加载提示词模板失败: ${error}`);
      return this.getFallbackPrompt(model, examType, promptType);
    }
  }
  
  /**
   * 获取通用提示词模板
   * @param model 模型名称
   * @param examType 考试类型
   * @param promptType 提示词类型
   * @returns 通用提示词模板
   */
  private static getFallbackPrompt(
    model: string,
    examType: string,
    promptType: PromptType
  ): PromptConfig {
    // 根据提示词类型返回不同的通用模板
    if (promptType === PromptType.FEEDBACK) {
      return {
        systemPrompt: `你是一位资深${examType}考官，请对提供的${examType}写作进行评分和反馈。`,
        userPrompt: `作文题目: {{title}}\n\n作文内容:\n{{content}}\n\n请提供全面的评分和反馈。`,
        maxTokens: 2000,
        outputFormat: 'json'
      };
    } else if (promptType === PromptType.ANNOTATION) {
      // 段落批注
      return {
        systemPrompt: `你是一位资深${examType}写作教师，请对提供的段落进行批注和改进建议。`,
        userPrompt: `段落内容:\n{{content}}\n\n请提供详细的批注和改进建议。`,
        maxTokens: 1000,
        outputFormat: 'json'
      };
    } else if (promptType === PromptType.EXAMPLE_ESSAY) {
      // 范文生成（新版）
      return {
        systemPrompt: `你是一位资深${examType}考官和写作教师，请根据提供的题目创建一篇高质量的${examType}范文。`,
        userPrompt: `题目: {{prompt}}\n\n考试类型: {{exam_type}}\n\n考试类别: {{exam_category}}\n\n目标分数: {{targetScore}}\n\n请创建一篇高质量的范文示例，展示如何获得目标分数水平的写作。`,
        maxTokens: 2500,
        outputFormat: 'text'
      };
    } else if (promptType === PromptType.CHAT) {
      // AI对话
      return {
        systemPrompt: `你是一位资深${examType}写作助手，可以解答用户关于写作的各种问题，提供针对性的建议和指导。`,
        userPrompt: `{{message}}`,
        maxTokens: 1000,
        outputFormat: 'text'
      };
    } else {
      // 范文生成
      return {
        systemPrompt: `你是一位资深${examType}考官和写作教师，请根据提供的题目创建一篇高质量的${examType}范文。`,
        userPrompt: `题目: {{prompt}}\n\n目标分数: {{targetScore}}\n\n请创建一篇高质量的范文示例，展示如何获得目标分数水平的写作。`,
        maxTokens: 2500,
        outputFormat: 'text'
      };
    }
  }
  
  /**
   * 清除提示词缓存
   */
  static clearCache(): void {
    this.promptCache.clear();
    console.info('[PromptManager] 提示词缓存已清除');
  }
  
  /**
   * 获取当前缓存大小
   * @returns 缓存中的提示词模板数量
   */
  static getCacheSize(): number {
    return this.promptCache.size;
  }
}

export default PromptManager; 