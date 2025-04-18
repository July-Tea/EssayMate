import { Router } from 'express';
import { IELTSService } from '../services/ai/IELTSService';
import { ApiError } from '../middleware/errorHandler';
import { ApiResponse, ValidateResponse, AIConfig } from '../types/api';

const router = Router();

router.post('/validate', async (req, res, next) => {
  try {
    console.log('收到验证请求:', JSON.stringify(req.body, null, 2));
    const config: AIConfig = req.body;
    
    if (!config.model || !config.apiKey) {
      throw new ApiError('模型和API密钥不能为空', 'INVALID_PARAMS', 400);
    }
    
    console.log('创建IELTSService实例:', JSON.stringify(config, null, 2));
    const aiService = new IELTSService(config);
    const validationResult = await aiService.validateApiKey();
    
    console.log('验证结果:', JSON.stringify(validationResult, null, 2));
    const response: ApiResponse<ValidateResponse> = {
      success: true,
      data: validationResult
    };
    
    res.json(response);
  } catch (error) {
    console.error('验证过程出错:', error);
    next(error);
  }
});

export const authRouter = router;