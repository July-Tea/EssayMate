import { Router, RequestHandler } from 'express';
import { Database } from 'sqlite3';
import { ProjectModel, ProjectCreate } from '../models/Project';
import { EssayVersionModel, EssayVersionCreate } from '../models/EssayVersion';
import { FeedbackModel, FeedbackCreate } from '../models/Feedback';
import { ProjectStatus, FeedbackStatus } from '../types/common';
import { ApiError } from '../middleware/errorHandler';
import { ExampleEssayModel } from '../models/ExampleEssay';

const router = Router();
const db = new Database('database.sqlite');
const projectModel = new ProjectModel(db);
const essayVersionModel = new EssayVersionModel(db);
const feedbackModel = new FeedbackModel(db);
const exampleEssayModel = new ExampleEssayModel(db);

// 创建新项目
router.post('/', async (req, res, next) => {
  try {
    const projectData: ProjectCreate = req.body;
    
    // 确保chartImage字段正确处理
    if (projectData.chartImage && typeof projectData.chartImage === 'object') {
      projectData.chartImage = JSON.stringify(projectData.chartImage);
    }
    
    // 创建项目
    const project = await projectModel.create(projectData);
    
    // 将chartImage字段转换回对象（如果存在）
    if (project.chartImage) {
      try {
        project.chartImage = JSON.parse(project.chartImage);
      } catch (e) {
        console.error('解析项目图片数据失败:', e);
      }
    }
    
    // 创建初始版本
    const initialVersionData: EssayVersionCreate = {
      projectId: project.id,
      versionNumber: 1,
      content: projectData.prompt || '', // 使用 prompt 作为初始内容
      wordCount: projectData.prompt ? projectData.prompt.split(/\s+/).length : 0,
      status: ProjectStatus.DRAFT
    };
    
    // 创建版本记录
    const version = await essayVersionModel.create(initialVersionData);
    
    // 创建初始反馈记录
    const initialFeedbackData: FeedbackCreate = {
      projectId: project.id,
      essayVersionId: version.id,
      versionNumber: 1,
      scoreTR: 0,
      scoreCC: 0,
      scoreLR: 0,
      scoreGRA: 0,
      feedbackTR: '暂无评分',
      feedbackCC: '暂无评分',
      feedbackLR: '暂无评分',
      feedbackGRA: '暂无评分',
      overallFeedback: '暂无总体评价',
      annotations: [],
      improvementSuggestions: []
    };
    
    // 创建反馈记录
    await feedbackModel.create(initialFeedbackData);
    
    res.status(201).json({
      success: true,
      data: project
    });
  } catch (error) {
    next(error);
  }
});

// 获取所有项目
router.get('/', async (req, res, next) => {
  try {
    const projects = await projectModel.findAll();
    
    // 处理项目中的chartImage字段
    const processedProjects = projects.map(project => {
      const processed = { ...project };
      if (processed.chartImage) {
        try {
          processed.chartImage = JSON.parse(processed.chartImage);
        } catch (e) {
          console.error(`解析项目 ${project.id} 的图片数据失败:`, e);
        }
      }
      return processed;
    });
    
    // 获取每个项目的最新反馈
    const projectsWithFeedback = await Promise.all(processedProjects.map(async (project) => {
      const feedbacks = await feedbackModel.findByProjectId(project.id);
      const latestFeedback = feedbacks[feedbacks.length - 1];
      
      return {
        ...project,
        score_tr: latestFeedback?.scoreTR,
        score_cc: latestFeedback?.scoreCC,
        score_lr: latestFeedback?.scoreLR,
        score_gra: latestFeedback?.scoreGRA,
        overall_score: latestFeedback?.overallScore,
        feedback_tr: latestFeedback?.feedbackTR,
        feedback_cc: latestFeedback?.feedbackCC,
        feedback_lr: latestFeedback?.feedbackLR,
        feedback_gra: latestFeedback?.feedbackGRA,
        overall_feedback: latestFeedback?.overallFeedback,
        annotations: latestFeedback?.annotations,
        improvement_suggestions: latestFeedback?.improvementSuggestions,
        feedback_status: latestFeedback?.status
      };
    }));
    
    res.json({
      success: true,
      data: projectsWithFeedback
    });
  } catch (error) {
    next(error);
  }
});

// 获取单个项目及其所有版本和反馈
router.get('/:id', async (req, res, next) => {
  try {
    const projectId = parseInt(req.params.id);
    const project = await projectModel.findById(projectId);
    
    if (!project) {
      throw new ApiError('PROJECT_NOT_FOUND', '项目不存在');
    }
    
    // 处理chartImage字段
    if (project.chartImage) {
      try {
        project.chartImage = JSON.parse(project.chartImage);
      } catch (e) {
        console.error(`解析项目 ${project.id} 的图片数据失败:`, e);
      }
    }
    
    const versions = await essayVersionModel.findByProjectId(projectId);
    const feedbacks = await feedbackModel.findByProjectId(projectId);
    
    res.json({
      success: true,
      data: {
        project,
        versions,
        feedbacks
      }
    });
  } catch (error) {
    next(error);
  }
});

// 创建新版本
router.post('/:id/versions', async (req, res, next) => {
  try {
    const projectId = parseInt(req.params.id);
    const project = await projectModel.findById(projectId);
    
    if (!project) {
      throw new ApiError('PROJECT_NOT_FOUND', '项目不存在');
    }
    
    const versionData: EssayVersionCreate = {
      projectId,
      versionNumber: project.totalVersions + 1,
      content: Array.isArray(req.body.content) ? req.body.content.join('\n\n') : req.body.content,
      wordCount: req.body.wordCount,
      status: ProjectStatus.SUBMITTED
    };
    
    const version = await essayVersionModel.create(versionData);
    
    // 更新项目状态和版本信息
    await projectModel.update(projectId, {
      status: ProjectStatus.SUBMITTED,
      currentVersion: version.versionNumber,
      totalVersions: version.versionNumber
    });

    // 创建初始反馈记录
    const initialFeedbackData: FeedbackCreate = {
      projectId,
      essayVersionId: version.id,
      versionNumber: version.versionNumber,
      scoreTR: 0,
      scoreCC: 0,
      scoreLR: 0,
      scoreGRA: 0,
      feedbackTR: '暂无评分',
      feedbackCC: '暂无评分',
      feedbackLR: '暂无评分',
      feedbackGRA: '暂无评分',
      overallFeedback: '暂无总体评价',
      annotations: [],
      improvementSuggestions: []
    };
    
    try {
      // 创建反馈记录
      await feedbackModel.create(initialFeedbackData);
    } catch (feedbackError) {
      console.error('创建反馈记录失败:', feedbackError);
      // 继续执行，不影响版本创建的返回
    }
    
    res.status(201).json({
      success: true,
      data: version
    });
  } catch (error) {
    next(error);
  }
});

// 创建反馈
router.post('/:id/versions/:versionNumber/feedback', async (req, res, next) => {
  try {
    const projectId = parseInt(req.params.id);
    const versionNumber = parseInt(req.params.versionNumber);
    
    const project = await projectModel.findById(projectId);
    if (!project) {
      throw new ApiError('PROJECT_NOT_FOUND', '项目不存在');
    }
    
    const version = await essayVersionModel.findByProjectIdAndVersion(projectId, versionNumber);
    if (!version) {
      throw new ApiError('VERSION_NOT_FOUND', '版本不存在');
    }
    
    const feedbackData: FeedbackCreate = {
      projectId,
      essayVersionId: version.id,
      versionNumber,
      ...req.body
    };
    
    const feedback = await feedbackModel.create(feedbackData);
    
    // 更新项目状态
    await projectModel.update(projectId, {
      status: ProjectStatus.REVIEWED
    });
    
    res.status(201).json({
      success: true,
      data: feedback
    });
  } catch (error) {
    next(error);
  }
});

// 更新反馈状态
router.patch('/:id/versions/:versionNumber/feedback/status', async (req, res, next) => {
  try {
    const projectId = parseInt(req.params.id);
    const versionNumber = parseInt(req.params.versionNumber);
    const { status } = req.body;
    
    const project = await projectModel.findById(projectId);
    if (!project) {
      throw new ApiError('PROJECT_NOT_FOUND', '项目不存在');
    }
    
    const version = await essayVersionModel.findByProjectIdAndVersion(projectId, versionNumber);
    if (!version) {
      throw new ApiError('VERSION_NOT_FOUND', '版本不存在');
    }
    
    const feedback = await feedbackModel.findByVersionId(version.id);
    if (!feedback) {
      throw new ApiError('FEEDBACK_NOT_FOUND', '反馈不存在');
    }
    
    await feedbackModel.updateStatus(feedback.id, status);
    
    if (status === FeedbackStatus.COMPLETED) {
      await projectModel.update(projectId, {
        status: ProjectStatus.REVIEWED
      });
    }
    
    res.json({
      success: true,
      data: { status }
    });
  } catch (error) {
    next(error);
  }
});

// 删除项目（软删除）
router.patch('/:id/delete', async (req, res, next) => {
  try {
    const projectId = parseInt(req.params.id);
    
    // 软删除项目
    await projectModel.delete(projectId);
    
    // 软删除相关的版本和反馈
    await essayVersionModel.deleteByProjectId(projectId);
    await feedbackModel.deleteByProjectId(projectId);
    
    res.json({
      success: true,
      message: '项目已删除'
    });
  } catch (error) {
    next(error);
  }
});

// 更新项目
router.put('/:id', async (req, res, next) => {
  try {
    const projectId = parseInt(req.params.id);
    const projectData = req.body;
    
    // 确保chartImage字段正确处理
    if (projectData.chartImage !== undefined && projectData.chartImage !== null && typeof projectData.chartImage === 'object') {
      projectData.chartImage = JSON.stringify(projectData.chartImage);
    }
    
    // 更新项目
    const updatedProject = await projectModel.update(projectId, projectData);
    
    // 将chartImage字段转换回对象（如果存在）
    if (updatedProject.chartImage) {
      try {
        updatedProject.chartImage = JSON.parse(updatedProject.chartImage);
      } catch (e) {
        console.error('解析项目图片数据失败:', e);
      }
    }
    
    res.json({
      success: true,
      data: updatedProject
    });
  } catch (error) {
    next(error);
  }
});

// 获取项目所有范文
router.get('/:projectId/example-essays', (async (req, res, next) => {
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

    // 获取项目信息
    const projectModel = new ProjectModel(db);
    const project = await projectModel.findById(Number(projectId));
    
    if (!project) {
      return res.status(404).json({ 
        success: false, 
        error: { 
          code: 'PROJECT_NOT_FOUND', 
          message: '项目不存在' 
        } 
      });
    }

    // 获取所有范文
    const examples = await exampleEssayModel.findByProjectId(Number(projectId));
    
    res.json({
      success: true,
      data: examples
    });
  } catch (error) {
    next(error);
  }
}) as RequestHandler);

// 获取特定版本的范文
router.get('/:projectId/versions/:versionNumber/example-essay', (async (req, res, next) => {
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

    // 获取范文
    const example = await exampleEssayModel.findByProjectIdAndVersion(
      Number(projectId), 
      Number(versionNumber)
    );
    
    if (!example) {
      return res.status(404).json({ 
        success: false, 
        error: { 
          code: 'NOT_FOUND', 
          message: '未找到范文' 
        } 
      });
    }
    
    res.json({
      success: true,
      data: example
    });
  } catch (error) {
    next(error);
  }
}) as RequestHandler);

// 搜索范文
router.get('/:projectId/example-essays/search', (async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { keyword } = req.query;
    
    if (!projectId || isNaN(Number(projectId))) {
      return res.status(400).json({ 
        success: false, 
        error: { 
          code: 'INVALID_ID', 
          message: '无效的项目ID' 
        } 
      });
    }

    if (!keyword || typeof keyword !== 'string') {
      return res.status(400).json({ 
        success: false, 
        error: { 
          code: 'INVALID_KEYWORD', 
          message: '请提供有效的搜索关键词' 
        } 
      });
    }

    // 获取项目信息
    const project = await projectModel.findById(Number(projectId));
    
    if (!project) {
      return res.status(404).json({ 
        success: false, 
        error: { 
          code: 'PROJECT_NOT_FOUND', 
          message: '项目不存在' 
        } 
      });
    }

    // 搜索范文
    const examples = await exampleEssayModel.searchByKeyword(
      Number(projectId),
      keyword
    );
    
    res.json({
      success: true,
      data: examples
    });
  } catch (error) {
    next(error);
  }
}) as RequestHandler);

export { router as projectRouter };