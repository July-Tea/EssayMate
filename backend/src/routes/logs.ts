import { Router } from 'express';
import { LogController } from '../controllers/LogController';

const router = Router();
const logController = new LogController();

// 获取日志列表
router.get('/', (req, res) => logController.getLogs(req, res));

// 获取日志统计信息
router.get('/stats', (req, res) => logController.getLogStats(req, res));

// 获取服务类型列表
router.get('/service-types', (req, res) => logController.getServiceTypes(req, res));

// 获取模型名称列表
router.get('/model-names', (req, res) => logController.getModelNames(req, res));

// 获取日志详情
router.get('/:id', (req, res) => logController.getLogDetail(req, res));

export default router; 