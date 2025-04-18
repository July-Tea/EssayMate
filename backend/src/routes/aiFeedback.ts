import { Router } from 'express';
import { AIFeedbackController } from '../controllers/AIFeedbackController';
import { EssayFeedbackFactory } from '../services/ai/EssayFeedbackFactory';
import { ApiError } from '../middleware/errorHandler';
import { PromptLogModel } from '../models/PromptLog';
import { FeedbackModel } from '../models/Feedback';
import { ProjectModel } from '../models/Project';
import { EssayVersionModel } from '../models/EssayVersion';
import { ExampleEssayModel, ExampleEssayCreate } from '../models/ExampleEssay';
import { getDatabaseConnection } from '../data-source';
import { ProjectStatus } from '../types/common';

const router = Router();
const aiFeedbackController = new AIFeedbackController();

// 根据项目ID和版本号生成批改 - 通用API端点
router.post('/projects/:projectId/versions/:versionNumber/generate/:model?', 
  (req, res, next) => aiFeedbackController.generateFeedback(req, res, next)
);

// 使用当前活跃模型批改作文 - 兼容性API端点 (为了兼容旧版前端保留，但建议使用上面的通用端点)
router.post('/projects/:projectId/versions/:versionNumber/generate-model', 
  (req, res, next) => aiFeedbackController.generateModelFeedback(req, res, next)
);

// 旧版豆包API路径 - 重定向到活跃模型批改 (为了向后兼容)
// @deprecated 此路由已废弃，请使用通用的generate/:model路由
router.post('/projects/:projectId/versions/:versionNumber/generate-doubao', 
  (req, res, next) => aiFeedbackController.generateModelFeedback(req, res, next)
);

// 获取批改状态
router.get('/status/:feedbackId',
  (req, res, next) => aiFeedbackController.getFeedbackStatus(req, res, next)
);

// 获取批改进度
router.get('/progress/:feedbackId',
  (req, res, next) => aiFeedbackController.getFeedbackProgress(req, res, next)
);

// 添加：生成范文API
router.post('/projects/:projectId/versions/:versionNumber/example-essay/:model?', 
  (req, res, next) => aiFeedbackController.generateExampleEssay(req, res, next)
);

// 添加：单独获取范文API（不需要项目和版本）
router.post('/example-essay/:model?', 
  (req, res, next) => aiFeedbackController.generateExampleEssay(req, res, next)
);

// 新增：生成范文
router.post('/example-essay', async (req, res, next) => {
  try {
    const { 
      prompt,           // 作文题目
      examType,         // 考试类型 (如 'ielts', 'toefl')
      examCategory,     // 考试类别 (如 'task1', 'task2')
      targetScore,      // 目标分数
      projectId,        // 项目ID
      versionNumber,    // 版本号
      model,            // 模型名称
      apiKey,           // API密钥
      modelConfig       // 模型配置
    } = req.body;

    if (!prompt) throw new ApiError('请提供作文题目', 'MISSING_PROMPT');
    if (!model) throw new ApiError('请提供AI模型名称', 'MISSING_MODEL');
    if (!apiKey) throw new ApiError('请提供API密钥', 'MISSING_API_KEY');
    if (!examType) throw new ApiError('请提供考试类型', 'MISSING_EXAM_TYPE');
    
    const projectIdNum = projectId ? Number(projectId) : undefined;
    const versionNumberNum = versionNumber ? Number(versionNumber) : 1;
    
    console.log(`开始生成范文请求 | 项目ID: ${projectIdNum || '未指定'} | 版本: ${versionNumberNum} | 考试类型: ${examType} | 目标分数: ${targetScore || '未指定'}`);
    
    // 如果提供了项目ID和版本号，获取对应的学生文章内容
    let essayContent = undefined;
    if (projectIdNum && versionNumberNum) {
      try {
        const essayVersionModel = new EssayVersionModel(getDatabaseConnection());
        const essayVersion = await essayVersionModel.findByProjectIdAndVersion(projectIdNum, versionNumberNum);
        if (essayVersion) {
          // 处理内容字段，确保是字符串格式
          if (typeof essayVersion.content === 'string') {
            essayContent = essayVersion.content;
          } else if (Array.isArray(essayVersion.content)) {
            // 修复类型错误：先进行数组类型检查
            const contentArray = essayVersion.content as string[];
            essayContent = contentArray.join('\n\n');
          }
          console.log(`获取到学生原文 | 项目ID: ${projectIdNum} | 版本: ${versionNumberNum} | 字数: ${essayVersion.wordCount}`);
        }
      } catch (error) {
        console.error('获取学生原文失败:', error);
      }
    }
    
    // 创建反馈服务
    const aiService = new EssayFeedbackFactory();
    const feedbackService = aiService.createFeedbackService(model, {
      model: model,
      api_key: apiKey,
      ...modelConfig
    });
    
    // 验证服务配置
    const isConfigValid = await feedbackService.validateConfig();
    if (!isConfigValid) {
      throw new ApiError('AI配置验证失败，请检查模型名称和API密钥', 'INVALID_CONFIG');
    }
    
    // 生成范文
    console.log(`调用AI服务生成范文 | 模型: ${model}`);
    
    // 创建传递给AI服务的参数对象
    const exampleParams: any = {
      examType,
      examCategory,
      targetScore,
      projectId: projectIdNum,
      versionNumber: versionNumberNum,
    };
    
    // 如果有学生原文，添加到参数中
    if (essayContent) {
      exampleParams.essayContent = essayContent;
    }
    
    // 调用AI服务生成范文
    const exampleResult = await feedbackService.getExampleEssay(prompt, exampleParams);
    
    // 如果需要，保存范文到数据库
    if (projectIdNum && versionNumberNum) {
      try {
        const exampleEssayModel = new ExampleEssayModel(getDatabaseConnection());
        
        // 检查是否已存在相同项目和版本号的范文
        const existingExample = await exampleEssayModel.findByProjectIdAndVersion(projectIdNum, versionNumberNum);
        
        // 构建范文数据
        const exampleData = {
          projectId: projectIdNum,
          versionNumber: versionNumberNum,
          exampleContent: exampleResult.exampleContent,
          improvement: exampleResult.improvement, // 保存改进建议
          wordCount: exampleResult.wordCount,
          status: ProjectStatus.COMPLETED
        };
        
        // 如果已存在，则更新；否则创建新范文
        if (existingExample) {
          // 这里可以实现一个update方法来更新已有的范文
          console.log(`范文已存在，需要更新 | 项目ID: ${projectIdNum} | 版本: ${versionNumberNum}`);
          // 暂时简单做删除再创建处理
          await exampleEssayModel.deleteByProjectId(projectIdNum);
          await exampleEssayModel.create(exampleData);
        } else {
          await exampleEssayModel.create(exampleData);
        }
        
        console.log(`范文已保存到数据库 | 项目ID: ${projectIdNum} | 版本: ${versionNumberNum}`);
      } catch (error) {
        console.error('保存范文失败:', error);
        // 这里我们继续响应结果，而不是抛出错误，因为生成功能已经完成
      }
    }
    
    res.status(200).json({
      success: true,
      data: exampleResult
    });
    
  } catch (error) {
    next(error);
  }
});

export const aiFeedbackRouter = router; 