import { Request, Response, NextFunction } from 'express';
import { EssayFeedbackFactory, ExamType } from '../services/ai/EssayFeedbackFactory';
import { IELTSFeedbackRequest, IELTSFeedbackService } from '../services/ai/IELTSFeedbackService';
import { FeedbackModel, FeedbackCreate, Annotation, FeedbackUpdate } from '../models/Feedback';
import { EssayVersionModel } from '../models/EssayVersion';
import { ProjectModel } from '../models/Project';
import { FeedbackStatus, ProjectStatus } from '../types/common';
import { ApiError } from '../middleware/errorHandler';
import { AppDataSource, getDatabaseConnection } from '../data-source';
import { ConfigService } from '../services/config/ConfigService';
import { ExampleEssayModel, ExampleEssayCreate } from '../models/ExampleEssay';
import { ConcurrentTaskManager } from '../utils/ConcurrentTaskManager';
import {
  FeedbackTask,
  AnnotationTask,
  ExampleEssayTask,
  FeedbackTaskResult,
  AnnotationTaskResult,
  ExampleEssayTaskResult
} from '../utils/FeedbackTasks';
import { GeneralSettingsService } from '../services/GeneralSettingsService';

// 扩展IELTSFeedbackRequest接口以包含generateExampleEssay属性
declare module '../services/ai/IELTSFeedbackService' {
  interface IELTSFeedbackRequest {
    generateExampleEssay?: boolean;
  }
}

/**
 * AI批改服务控制器
 * 处理AI批改请求并保存结果
 */
export class AIFeedbackController {
  private feedbackModel: FeedbackModel;
  private essayVersionModel: EssayVersionModel;
  private projectModel: ProjectModel;
  private configService: ConfigService;
  private feedbackFactory: EssayFeedbackFactory;
  private exampleEssayModel: ExampleEssayModel;
  private generalSettingsService: GeneralSettingsService;
  private useEnhancedFeedback: boolean = true; // 默认使用增强版批改
  private processingFeedbacks: Map<number, FeedbackProgress> = new Map();
  
  constructor() {
    const db = getDatabaseConnection();
    this.feedbackModel = new FeedbackModel(db);
    this.essayVersionModel = new EssayVersionModel(db);
    this.projectModel = new ProjectModel(db);
    this.configService = new ConfigService();
    this.feedbackFactory = new EssayFeedbackFactory();
    this.exampleEssayModel = new ExampleEssayModel(db);
    this.generalSettingsService = new GeneralSettingsService();

    // 从环境变量或配置中读取是否使用增强版批改
    this.useEnhancedFeedback = process.env.USE_ENHANCED_FEEDBACK !== 'false';
  }

  /**
   * 获取最大并发任务数设置
   */
  private async getMaxConcurrentTasks(): Promise<number> {
    try {
      return await this.generalSettingsService.getMaxConcurrentTasks();
    } catch (error) {
      console.error('获取最大并发任务数失败，使用默认值1:', error);
      return 1; // 默认值
    }
  }
  
  /**
   * 处理作文AI批改请求
   * @param req Express请求对象
   * @param res Express响应对象
   * @param next Express下一个中间件
   */
  async generateFeedback(req: Request, res: Response, next: NextFunction) {
    try {
      const { projectId, versionNumber, model } = req.params;
      const customPrompt = req.body.prompt;
      const generateExampleEssay = req.body.generateExampleEssay === true;
      
      // 参数验证
      if (!projectId || !versionNumber) {
        throw new ApiError('缺少项目ID或版本号', 'MISSING_PARAMS', 400);
      }
      
      // 获取项目信息
      const project = await this.projectModel.findById(parseInt(projectId));
      if (!project) {
        throw new ApiError('项目不存在', 'PROJECT_NOT_FOUND', 404);
      }
      
      // 获取作文版本
      const version = await this.essayVersionModel.findByProjectIdAndVersion(
        parseInt(projectId), 
        parseInt(versionNumber)
      );
      if (!version) {
        throw new ApiError('作文版本不存在', 'VERSION_NOT_FOUND', 404);
      }
      
      // 获取AI配置
      const aiModelName = model || 'doubao'; // 默认使用豆包
      const aiConfig = await this.configService.getActiveAIModelConfig();
      
      // 记录请求参数
      console.log(`[AI批改] [项目ID: ${projectId}] [版本: ${versionNumber}] [模型: ${aiModelName}] 接收到批改请求`);
      if (generateExampleEssay) {
        console.log(`[AI批改] [项目ID: ${projectId}] [版本: ${versionNumber}] 请求包含范文生成`);
      }
      
      // 创建批改服务
      const feedbackService = this.feedbackFactory.createFeedbackService(aiModelName, {
        model: aiModelName,
        apiKey: aiConfig.apiKey,
        ...aiConfig.modelConfigs
      });
      
      // 创建或更新反馈状态为进行中
      let feedback = await this.feedbackModel.findByVersionId(version.id);
      if (!feedback) {
        // 创建新的反馈记录
        feedback = await this.feedbackModel.create({
          projectId: project.id,
          essayVersionId: version.id,
          versionNumber: parseInt(versionNumber),
          scoreTR: 0,
          scoreCC: 0,
          scoreLR: 0,
          scoreGRA: 0,
          feedbackTR: '正在生成评分...',
          feedbackCC: '正在生成评分...',
          feedbackLR: '正在生成评分...',
          feedbackGRA: '正在生成评分...',
          overallFeedback: '正在生成批改结果，请稍候...',
          annotations: []
        });
      }
      
      // 更新状态为处理中
      await this.feedbackModel.updateStatus(feedback.id, FeedbackStatus.IN_PROGRESS);
      
      // 构建批改请求
      const feedbackRequest: IELTSFeedbackRequest = {
        title: project.title || '未提供题目',
        content: Array.isArray(version.content) ? version.content.join('\n\n') : version.content,
        prompt: customPrompt,
        projectId: projectId,
        versionNumber: versionNumber,
        generateExampleEssay: generateExampleEssay
      };
      
      // 添加目标分数（如果提供）
      if (req.body.targetScore) {
        console.log(`[AI批改] [项目ID: ${projectId}] [版本: ${versionNumber}] 设置目标分数: ${req.body.targetScore}`);
        feedbackRequest.targetScore = req.body.targetScore;
      }
      
      // 添加作文类型信息
      if (project.category) {
        const essayType = project.category === 'Writing1' ? 'Task 1' : 
                         project.category === 'Writing2' ? 'Task 2' : '';
        if (essayType) {
          console.log(`[AI批改] [项目ID: ${projectId}] [版本: ${versionNumber}] 设置作文类型: ${essayType}`);
          feedbackRequest.essayType = essayType;
        }
      }
      
      // 添加考试类型
      if (project.examType) {
        // 将字符串转换为枚举类型
        if (project.examType.toLowerCase() === 'ielts') {
          feedbackRequest.examType = ExamType.IELTS;
        } else if (project.examType.toLowerCase() === 'toefl') {
          feedbackRequest.examType = ExamType.TOEFL;
        } else if (project.examType.toLowerCase() === 'gre') {
          feedbackRequest.examType = ExamType.GRE;
        } else {
          feedbackRequest.examType = ExamType.IELTS; // 默认为IELTS
        }
      } else {
        feedbackRequest.examType = ExamType.IELTS; // 默认为IELTS
      }
      
      console.log(`[AI批改] [项目ID: ${projectId}] [版本: ${versionNumber}] [模型: ${aiModelName}] 构建批改请求完成`);
      
      // 异步调用AI批改服务
      this.processAIFeedback(
        feedbackService, 
        feedbackRequest, 
        feedback.id, 
        project.id
      ).catch(error => {
        console.error('AI批改过程发生错误:', error);
        // 更新状态为失败
        this.feedbackModel.updateStatus(feedback.id, FeedbackStatus.FAILED)
          .catch(err => console.error('更新反馈状态失败:', err));
      });
      
      // 立即返回处理中的状态
      res.status(202).json({
        success: true,
        data: {
          message: '批改请求已接受，正在处理中',
          feedbackId: feedback.id,
          status: FeedbackStatus.IN_PROGRESS
        }
      });
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * 基于活跃模型进行AI批改（替代原先的豆包专用批改方法）
   * @param req Express请求对象
   * @param res Express响应对象
   * @param next Express下一个中间件
   * @deprecated 此方法已废弃，请使用generateFeedback方法
   */
  async generateModelFeedback(req: Request, res: Response, next: NextFunction) {
    try {
      const { projectId, versionNumber } = req.params;
      const customPrompt = req.body.prompt;
      const examType = req.body.examType || ExamType.IELTS; // 默认为雅思考试
      
      // 记录请求参数
      console.log(`[AI批改] [项目ID: ${projectId}] [版本: ${versionNumber}] 接收到批改请求 [考试类型: ${examType}]`);
      
      // 参数验证
      if (!projectId || !versionNumber) {
        throw new ApiError('缺少项目ID或版本号', 'MISSING_PARAMS', 400);
      }
      
      // 获取项目信息
      const project = await this.projectModel.findById(parseInt(projectId));
      if (!project) {
        throw new ApiError('项目不存在', 'PROJECT_NOT_FOUND', 404);
      }
      
      // 获取作文版本
      const version = await this.essayVersionModel.findByProjectIdAndVersion(
        parseInt(projectId), 
        parseInt(versionNumber)
      );
      if (!version) {
        throw new ApiError('作文版本不存在', 'VERSION_NOT_FOUND', 404);
      }
      
      // 获取AI配置
      console.log(`[AI批改] [项目ID: ${projectId}] [版本: ${versionNumber}] 获取活跃的AI配置`);
      const aiConfig = await this.configService.getActiveAIModelConfig();
      
      // 从活跃配置中获取模型类型，确保使用用户在设置中选择的活跃模型
      const aiModelName = aiConfig.model || 'doubao'; // 如果没有设置，默认使用豆包
      
      // 创建批改服务
      console.log(`[AI批改] [项目ID: ${projectId}] [版本: ${versionNumber}] 创建批改服务 [模型: ${aiModelName}]`);
      const feedbackService = this.feedbackFactory.createFeedbackService(
        aiModelName, 
        {
          model: aiModelName,
          apiKey: aiConfig.apiKey,
          ...aiConfig.modelConfigs
        },
        examType as ExamType
      );
      
      // 创建或更新反馈状态为进行中
      let feedback = await this.feedbackModel.findByVersionId(version.id);
      if (!feedback) {
        console.log(`[AI批改] [项目ID: ${projectId}] [版本: ${versionNumber}] 创建新的反馈记录`);
        feedback = await this.feedbackModel.create({
          projectId: project.id,
          essayVersionId: version.id,
          versionNumber: parseInt(versionNumber),
          scoreTR: 0,
          scoreCC: 0,
          scoreLR: 0,
          scoreGRA: 0,
          feedbackTR: '正在生成评分...',
          feedbackCC: '正在生成评分...',
          feedbackLR: '正在生成评分...',
          feedbackGRA: '正在生成评分...',
          overallFeedback: '正在生成批改结果，请稍候...',
          annotations: []
        });
      } else {
        console.log(`[AI批改] [项目ID: ${projectId}] [版本: ${versionNumber}] 更新现有反馈记录 [反馈ID: ${feedback.id}]`);
      }
      
      // 更新状态为处理中
      await this.feedbackModel.updateStatus(feedback.id, FeedbackStatus.IN_PROGRESS);
      
      // 构建批改请求
      const feedbackRequest: IELTSFeedbackRequest = {
        title: project.title || '未提供题目',
        content: Array.isArray(version.content) ? version.content.join('\n\n') : version.content,
        prompt: customPrompt,
        examType: examType as ExamType,
        projectId: projectId,
        versionNumber: versionNumber
      };
      
      // 添加目标分数（如果提供）
      if (project.targetScore) {
        console.log(`[AI批改] [项目ID: ${projectId}] [版本: ${versionNumber}] 设置目标分数: ${project.targetScore}`);
        feedbackRequest.targetScore = project.targetScore;
      }
      
      // 添加作文类型信息
      if (project.category) {
        const essayType = project.category === 'Writing1' ? 'Task 1' : 
                         project.category === 'Writing2' ? 'Task 2' : '';
        if (essayType) {
          console.log(`[AI批改] [项目ID: ${projectId}] [版本: ${versionNumber}] 设置作文类型: ${essayType}`);
          feedbackRequest.essayType = essayType;
        }
      }
      
      // 记录完整请求内容
      console.log(`[AI批改] [项目ID: ${projectId}] [版本: ${versionNumber}] 批改请求准备完成`);
      
      // 异步调用AI批改服务
      console.log(`[AI批改] [项目ID: ${projectId}] [版本: ${versionNumber}] 开始异步批改 [反馈ID: ${feedback.id}]`);
      this.processAIFeedback(
        feedbackService, 
        feedbackRequest, 
        feedback.id, 
        project.id
      ).catch(error => {
        console.error(`[AI批改] [项目ID: ${projectId}] [版本: ${versionNumber}] 批改失败: ${error.message}`);
        
        // 更新状态为失败
        this.feedbackModel.updateStatus(feedback.id, FeedbackStatus.FAILED)
          .catch(err => console.error(`[AI批改] [项目ID: ${projectId}] [版本: ${versionNumber}] 更新状态失败: ${err.message}`));
      });
      
      // 立即返回处理中的状态
      res.status(202).json({
        success: true,
        data: {
          message: '批改请求已接受，正在处理中',
          feedbackId: feedback.id,
          status: FeedbackStatus.IN_PROGRESS
        }
      });
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * 获取批改进度
   * @param req Express请求对象
   * @param res Express响应对象
   * @param next Express下一个中间件
   */
  async getFeedbackProgress(req: Request, res: Response, next: NextFunction) {
    try {
      const { feedbackId } = req.params;
      
      if (!feedbackId) {
        throw new ApiError('缺少反馈ID', 'MISSING_FEEDBACK_ID', 400);
      }
      
      const feedback = await this.feedbackModel.findById(parseInt(feedbackId));
      if (!feedback) {
        throw new ApiError('反馈不存在', 'FEEDBACK_NOT_FOUND', 404);
      }

      // 获取进度信息
      const progressInfo = this.processingFeedbacks.get(feedback.id);
      
      // 如果反馈已完成或失败，从处理中列表中移除
      if (feedback.status === FeedbackStatus.COMPLETED || feedback.status === FeedbackStatus.FAILED) {
        this.processingFeedbacks.delete(feedback.id);
      }

      res.json({
        success: true,
        data: {
          currentStage: progressInfo?.currentStage || 'NONE',
          totalItems: progressInfo?.totalItems || 1,
          currentItem: progressInfo?.currentItem || 1,
          status: feedback.status
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 更新批改进度
   * @param feedbackId 反馈ID
   * @param currentStage 当前阶段
   * @param totalItems 总项目数
   * @param currentItem 当前项目
   */
  private updateProgress(
    feedbackId: number,
    currentStage: 'FEEDBACK' | 'ANNOTATION' | 'EXAMPLE_ESSAY' | 'NONE' | 'COMPLETED',
    totalItems: number,
    currentItem: number
  ) {
    this.processingFeedbacks.set(feedbackId, { currentStage, totalItems, currentItem });
  }

  /**
   * 生成范文
   * @param req Express请求对象
   * @param res Express响应对象
   * @param next Express下一个中间件
   */
  async generateExampleEssay(req: Request, res: Response, next: NextFunction) {
    try {
      const { projectId, versionNumber, model } = req.params;
      const { 
        prompt,
        examType, 
        examCategory, 
        targetScore 
      } = req.body;
      
      // 参数验证
      if (!prompt) {
        throw new ApiError('缺少作文题目', 'MISSING_PROMPT', 400);
      }
      
      console.log(`[范文生成] [项目ID: ${projectId || '未指定'}] [版本: ${versionNumber || '未指定'}] 接收到范文生成请求`);
      console.log(`[范文生成] 题目: ${prompt.substring(0, 50)}${prompt.length > 50 ? '...' : ''}`);
      console.log(`[范文生成] 考试类型: ${examType || 'IELTS'}, 考试类别: ${examCategory || '未指定'}, 目标分数: ${targetScore || '未指定'}`);
      
      // 获取AI配置
      const aiModelName = model || await this.configService.getCurrentAIModel() || 'doubao';
      const aiConfig = await this.configService.getActiveAIModelConfig();
      
      // 创建批改服务
      console.log(`[范文生成] 创建AI服务 [模型: ${aiModelName}]`);
      const feedbackService = this.feedbackFactory.createFeedbackService(aiModelName, {
        model: aiModelName,
        apiKey: aiConfig.apiKey,
        ...aiConfig.modelConfigs
      });
      
      // 调用生成范文接口
      console.log(`[范文生成] 开始生成范文`);
      const exampleEssay = await feedbackService.getExampleEssay(prompt, {
        examType: examType || 'IELTS',
        examCategory: examCategory,
        targetScore: targetScore,
        projectId: projectId ? parseInt(projectId) : undefined,
        versionNumber: versionNumber ? parseInt(versionNumber) : undefined,
        essayContent: req.body.essayContent || ''
      });
      
      console.log(`[范文生成] 范文生成成功 [字数: ${exampleEssay.wordCount}]`);
      
      // 如果有项目ID和版本号，保存到数据库
      if (projectId && versionNumber) {
        const projectIdNum = parseInt(projectId);
        const versionNumberNum = parseInt(versionNumber);
        
        try {
          // 获取项目信息
          const project = await this.projectModel.findById(projectIdNum);
          
          if (!project) {
            console.error(`[范文生成] 项目ID ${projectIdNum} 不存在，范文保存失败`);
          } else {
            // 查询是否已存在相同项目ID和版本号的范文
            const existingExample = await this.exampleEssayModel.findByProjectIdAndVersion(
              projectIdNum, 
              versionNumberNum
            );
            
            if (existingExample) {
              console.log(`[范文生成] 项目ID ${projectIdNum} 版本 ${versionNumberNum} 的范文已存在，需要更新`);
              // TODO: 添加更新范文的方法
            } else {
              // 创建新范文
              const exampleData: ExampleEssayCreate = {
                projectId: projectIdNum,
                versionNumber: versionNumberNum,
                exampleContent: exampleEssay.exampleContent,
                improvement: exampleEssay.improvement,
                wordCount: exampleEssay.wordCount,
                status: project.status
              };
              
              await this.exampleEssayModel.create(exampleData);
              console.log(`[范文生成] 范文已保存到数据库 [项目ID: ${projectIdNum}] [版本: ${versionNumberNum}]`);
            }
          }
        } catch (dbError) {
          console.error(`[范文生成] 保存范文到数据库失败: ${dbError}`);
          // 不影响API返回，只记录错误
        }
      }
      
      // 返回结果
      res.json({
        success: true,
        data: {
          example: exampleEssay.exampleContent,
          wordCount: exampleEssay.wordCount,
          tokenUsage: exampleEssay.tokenUsage
        }
      });
    } catch (error) {
      console.error(`[范文生成] 生成失败: ${error}`);
      next(error);
    }
  }

  /**
   * 处理AI批改 - 并发版本
   * @param feedbackService AI批改服务实例
   * @param request 批改请求
   * @param feedbackId 反馈ID
   * @param projectId 项目ID
   */
  private async processAIFeedback(
    feedbackService: IELTSFeedbackService,
    request: IELTSFeedbackRequest,
    feedbackId: number,
    projectId: number
  ): Promise<void> {
    const startTime = Date.now();

    try {
      console.log(`[AI批改-并发] [项目ID: ${projectId}] [版本: ${request.versionNumber}] 开始处理批改请求 [反馈ID: ${feedbackId}]`);

      // 记录开始时间
      await this.feedbackModel.updateStartTime(feedbackId);

      // 更新essay_version状态为处理中
      await this.essayVersionModel.updateStatusByVersionNumber(
        projectId,
        parseInt(request.versionNumber as string),
        ProjectStatus.PROCESSING
      );

      // 获取最大并发任务数设置并创建并发任务管理器
      const maxConcurrentTasks = await this.getMaxConcurrentTasks();
      const taskManager = new ConcurrentTaskManager<any>(maxConcurrentTasks);

      console.log(`[AI批改-并发] [项目ID: ${projectId}] [版本: ${request.versionNumber}] 使用最大并发数: ${maxConcurrentTasks}`);

      // 分割内容为段落
      let paragraphs: string[] = [];
      if (typeof request.content === 'string') {
        paragraphs = request.content.split(/\n\s*\n/).filter((p: string) => p.trim());
        console.log(`[AI批改-并发] [项目ID: ${projectId}] [版本: ${request.versionNumber}] 内容已分为 ${paragraphs.length} 个段落`);
      } else if (Array.isArray(request.content)) {
        paragraphs = (request.content as string[]).filter((p: string) => p && p.trim());
        console.log(`[AI批改-并发] [项目ID: ${projectId}] [版本: ${request.versionNumber}] 内容是数组，包含 ${paragraphs.length} 个段落`);
      }

      // 创建所有任务并发执行
      console.log(`[AI批改-并发] [项目ID: ${projectId}] [版本: ${request.versionNumber}] 开始创建所有任务`);

      // 任务1: 创建反馈任务
      const feedbackTask = new FeedbackTask(feedbackService, request, projectId, request.versionNumber as string);
      taskManager.addTask(feedbackTask.taskId, () => feedbackTask.execute());
      console.log(`[AI批改-并发] [项目ID: ${projectId}] [版本: ${request.versionNumber}] 已添加反馈任务`);

      // 任务2-N: 创建批注任务
      const annotationTasks: AnnotationTask[] = [];
      for (let i = 0; i < paragraphs.length; i++) {
        const paragraph = paragraphs[i];
        const annotationTask = new AnnotationTask(
          feedbackService,
          paragraph,
          i,
          {
            allParagraphs: paragraphs,
            feedback: '', // 批注任务不依赖反馈结果，可以并发执行
            targetScore: request.targetScore,
            essayType: request.essayType,
            projectId: projectId.toString(),
            versionNumber: request.versionNumber
          }
        );

        annotationTasks.push(annotationTask);
        taskManager.addTask(annotationTask.taskId, () => annotationTask.execute());
      }

      console.log(`[AI批改-并发] [项目ID: ${projectId}] [版本: ${request.versionNumber}] 已添加 ${annotationTasks.length} 个批注任务`);

      // 任务N+1: 创建范文任务（如果需要）
      let exampleEssayTask: ExampleEssayTask | null = null;
      if (request.generateExampleEssay) {
        console.log(`[AI批改-并发] [项目ID: ${projectId}] [版本: ${request.versionNumber}] 创建范文任务`);

        let essayCategory = '';
        if (request.essayType) {
          essayCategory = request.essayType === 'Task 1' ? 'task1' :
                         request.essayType === 'Task 2' ? 'task2' : '';
        }

        exampleEssayTask = new ExampleEssayTask(
          feedbackService,
          request.title,
          {
            examType: request.examType || 'IELTS',
            examCategory: essayCategory,
            targetScore: request.targetScore,
            projectId: projectId,
            versionNumber: parseInt(request.versionNumber as string),
            essayContent: request.content || ''
          }
        );

        taskManager.addTask(exampleEssayTask.taskId, () => exampleEssayTask!.execute());
        console.log(`[AI批改-并发] [项目ID: ${projectId}] [版本: ${request.versionNumber}] 已添加范文任务`);
      }

      // 执行所有任务（反馈 + 批注 + 范文）
      const totalTasks = 1 + paragraphs.length + (exampleEssayTask ? 1 : 0); // feedback + annotations + example
      this.updateProgress(feedbackId, 'ANNOTATION', totalTasks, 0);

      console.log(`[AI批改-并发] [项目ID: ${projectId}] [版本: ${request.versionNumber}] 开始并发执行 ${totalTasks} 个任务 (反馈:1, 批注:${paragraphs.length}, 范文:${exampleEssayTask ? 1 : 0})`);
      await taskManager.executeAll();

      // 获取反馈结果
      const feedbackResult = taskManager.getResult(feedbackTask.taskId) as FeedbackTaskResult;
      if (!feedbackResult) {
        throw new Error('反馈任务执行失败');
      }

      console.log(`[AI批改-并发] [项目ID: ${projectId}] [版本: ${request.versionNumber}] 反馈任务完成，获取到评分`);

      // 检查反馈合理性
      const feedbackLength = {
        TR: feedbackResult.feedbackTR.length,
        CC: feedbackResult.feedbackCC.length,
        LR: feedbackResult.feedbackLR.length,
        GRA: feedbackResult.feedbackGRA.length,
        overall: feedbackResult.overallFeedback.length
      };

      // 如果所有评分都是0，记录警告
      if (feedbackResult.scoreTR === 0 && feedbackResult.scoreCC === 0 && feedbackResult.scoreLR === 0 && feedbackResult.scoreGRA === 0) {
        console.warn(`[AI批改-并发] [项目ID: ${projectId}] [版本: ${request.versionNumber}] 警告: 所有评分都为0，可能存在API响应问题`);
      }

      // 如果任一反馈文本很短，记录警告
      if (feedbackLength.TR < 10 || feedbackLength.CC < 10 || feedbackLength.LR < 10 || feedbackLength.GRA < 10) {
        console.warn(`[AI批改-并发] [项目ID: ${projectId}] [版本: ${request.versionNumber}] 警告: 部分评价文本过短，可能存在格式问题`);
      }

      // 收集批注结果并按段落顺序排序
      const allAnnotations: Annotation[] = [];
      for (const annotationTask of annotationTasks) {
        const annotationResult = taskManager.getResult(annotationTask.taskId) as AnnotationTaskResult;
        if (annotationResult && annotationResult.annotations.length > 0) {
          allAnnotations.push(...annotationResult.annotations);
        }

        const error = taskManager.getError(annotationTask.taskId);
        if (error) {
          console.error(`[AI批改-并发] [项目ID: ${projectId}] [版本: ${request.versionNumber}] 段落 ${annotationResult?.paragraphIndex + 1 || '未知'} 批注任务失败:`, error.message);
        }
      }

      console.log(`[AI批改-并发] [项目ID: ${projectId}] [版本: ${request.versionNumber}] 总共生成 ${allAnnotations.length} 条批注`);

      // 处理范文结果（如果有）
      if (exampleEssayTask) {
        const exampleResult = taskManager.getResult(exampleEssayTask.taskId) as ExampleEssayTaskResult;
        const exampleError = taskManager.getError(exampleEssayTask.taskId);

        if (exampleResult) {
          console.log(`[AI批改-并发] [项目ID: ${projectId}] [版本: ${request.versionNumber}] 范文生成成功 [字数: ${exampleResult.wordCount}]`);

          // 将范文保存到数据库
          try {
            const exampleData: ExampleEssayCreate = {
              projectId: projectId,
              versionNumber: parseInt(request.versionNumber as string),
              exampleContent: exampleResult.exampleContent,
              improvement: exampleResult.improvement,
              wordCount: exampleResult.wordCount,
              status: ProjectStatus.REVIEWED
            };

            // 先查询是否已存在
            const existingExample = await this.exampleEssayModel.findByProjectIdAndVersion(
              projectId,
              parseInt(request.versionNumber as string)
            );

            if (existingExample) {
              console.log(`[AI批改-并发] [项目ID: ${projectId}] [版本: ${request.versionNumber}] 范文已存在，需要更新`);
              // TODO: 添加更新范文的逻辑
            } else {
              await this.exampleEssayModel.create(exampleData);
              console.log(`[AI批改-并发] [项目ID: ${projectId}] [版本: ${request.versionNumber}] 范文已保存到数据库`);
            }
          } catch (dbError) {
            console.error(`[AI批改-并发] [项目ID: ${projectId}] [版本: ${request.versionNumber}] 保存范文失败: ${dbError}`);
            // 保存范文失败不影响主流程
          }
        } else if (exampleError) {
          console.error(`[AI批改-并发] [项目ID: ${projectId}] [版本: ${request.versionNumber}] 范文生成失败:`, exampleError.message);
          // 范文生成失败不影响主流程
        }
      }

      // 更新数据库
      console.log(`[AI批改-并发] [项目ID: ${projectId}] [版本: ${request.versionNumber}] 更新数据库反馈记录 [反馈ID: ${feedbackId}]`);

      const updateData: FeedbackUpdate = {
        status: FeedbackStatus.COMPLETED,
        scoreTR: feedbackResult.scoreTR,
        scoreCC: feedbackResult.scoreCC,
        scoreLR: feedbackResult.scoreLR,
        scoreGRA: feedbackResult.scoreGRA,
        feedbackTR: feedbackResult.feedbackTR,
        feedbackCC: feedbackResult.feedbackCC,
        feedbackLR: feedbackResult.feedbackLR,
        feedbackGRA: feedbackResult.feedbackGRA,
        overallFeedback: feedbackResult.overallFeedback,
        annotations: allAnnotations
      };

      await this.feedbackModel.update(feedbackId, updateData);
      console.log(`[AI批改-并发] [项目ID: ${projectId}] [版本: ${request.versionNumber}] 反馈记录更新成功 [反馈ID: ${feedbackId}]`);

      // 更新项目和版本状态
      await this.projectModel.update(projectId, { status: ProjectStatus.REVIEWED });
      console.log(`[AI批改-并发] [项目ID: ${projectId}] [版本: ${request.versionNumber}] 更新项目状态为已批改 [项目ID: ${projectId}]`);

      await this.essayVersionModel.updateStatusByVersionNumber(
        projectId,
        parseInt(request.versionNumber as string),
        ProjectStatus.REVIEWED
      );
      console.log(`[AI批改-并发] [项目ID: ${projectId}] [版本: ${request.versionNumber}] 更新essay_version状态为已批改`);

      // 记录完成时间
      await this.feedbackModel.updateCompletionTime(feedbackId);

      // 清除进度信息
      this.processingFeedbacks.delete(feedbackId);

      // 计算总耗时
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      console.log(`[AI批改-并发] [项目ID: ${projectId}] [版本: ${request.versionNumber}] 批改流程完成 [反馈ID: ${feedbackId}] [总耗时: ${totalTime}ms]`);
    } catch (error: any) {
      console.error(`[AI批改-并发] [项目ID: ${projectId}] [版本: ${request.versionNumber}] 批改过程发生错误: ${error.message || '未知错误'}`);
      // 清除进度信息
      this.processingFeedbacks.delete(feedbackId);
      throw error;
    }
  }
  
  /**
   * 查询批改状态
   * @param req Express请求对象
   * @param res Express响应对象
   * @param next Express下一个中间件
   */
  async getFeedbackStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { feedbackId } = req.params;
      
      if (!feedbackId) {
        throw new ApiError('缺少反馈ID', 'MISSING_FEEDBACK_ID', 400);
      }
      
      const feedback = await this.feedbackModel.findById(parseInt(feedbackId));
      if (!feedback) {
        throw new ApiError('反馈不存在', 'FEEDBACK_NOT_FOUND', 404);
      }

      // 获取对应的项目
      const project = await this.projectModel.findById(feedback.projectId);
      
      // 计算进度百分比
      let progressPercentage = 0;
      let progressStep = '';
      
      switch (feedback.status) {
        case FeedbackStatus.PENDING:
          progressPercentage = 0;
          progressStep = '等待批改';
          break;
        case FeedbackStatus.IN_PROGRESS:
          // 根据反馈字段是否已有内容来估算进度
          if (feedback.feedbackTR && feedback.feedbackTR.length > 0) {
            progressPercentage = 75;
            progressStep = '评分与反馈';
          } else {
            progressPercentage = 35;
            progressStep = '分析文章';
          }
          break;
        case FeedbackStatus.COMPLETED:
          progressPercentage = 100;
          progressStep = '批改完成';
          break;
        case FeedbackStatus.FAILED:
          progressPercentage = 0;
          progressStep = '批改失败';
          break;
      }

      res.json({
        success: true,
        data: {
          id: feedback.id,
          projectId: feedback.projectId,
          essayVersionId: feedback.essayVersionId,
          versionNumber: feedback.versionNumber,
          status: feedback.status,
          scoreTR: feedback.scoreTR,
          scoreCC: feedback.scoreCC,
          scoreLR: feedback.scoreLR,
          scoreGRA: feedback.scoreGRA,
          overallScore: feedback.overallScore,
          completedAt: feedback.completedAt,
          // 添加进度相关信息
          progress: {
            percentage: progressPercentage,
            step: progressStep,
            startedAt: feedback.startedAt,
            estimatedTimeRemaining: feedback.status === FeedbackStatus.IN_PROGRESS ? '约1-2分钟' : null
          },
          // 添加项目信息
          project: project ? {
            title: project.title,
            status: project.status
          } : null
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

/**
 * 进度信息接口
 */
interface FeedbackProgress {
  currentStage: 'FEEDBACK' | 'ANNOTATION' | 'EXAMPLE_ESSAY' | 'NONE' | 'COMPLETED';
  totalItems: number;
  currentItem: number;
} 