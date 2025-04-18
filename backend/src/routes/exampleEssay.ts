import express, { RequestHandler } from 'express';
import { exampleEssayController } from '../controllers/exampleEssayController';

const router = express.Router();

// 创建新范文
router.post('/', exampleEssayController.create as RequestHandler);

// 获取项目的所有范文
router.get('/project/:projectId', exampleEssayController.getByProjectId as RequestHandler);

// 获取特定版本的范文
router.get('/project/:projectId/version/:versionNumber', exampleEssayController.getByProjectIdAndVersion as RequestHandler);

// 删除特定项目的所有范文
router.delete('/project/:projectId', exampleEssayController.deleteByProjectId as RequestHandler);

// 更新范文状态
router.patch('/project/:projectId/version/:versionNumber/status', exampleEssayController.updateStatus as RequestHandler);

export const exampleEssayRouter = router; 