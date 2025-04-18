import { Router } from 'express';
import { IELTSService } from '../services/ai/IELTSService';
import { ApiError } from '../middleware/errorHandler';

const router = Router();

// 生成作文反馈
router.post('/feedback', async (req, res, next) => {
  try {
    const { essay, model, apiKey } = req.body;
    if (!essay) throw new ApiError('请提供作文内容');
    if (!model || !apiKey) throw new ApiError('请提供AI配置信息');

    const aiService = new IELTSService({ model, apiKey });
    const feedback = await aiService.generateEssayFeedback(essay);
    
    res.json({
      success: true,
      data: feedback
    });
  } catch (error) {
    next(error);
  }
});

// 生成作文改进建议
router.post('/improvement', async (req, res, next) => {
  try {
    const { essay, model, apiKey } = req.body;
    if (!essay) throw new ApiError('请提供作文内容');
    if (!model || !apiKey) throw new ApiError('请提供AI配置信息');

    const aiService = new IELTSService({ model, apiKey });
    const improvement = await aiService.generateEssayImprovement(essay);
    
    res.json({
      success: true,
      data: improvement
    });
  } catch (error) {
    next(error);
  }
});

export const aiRouter = router;