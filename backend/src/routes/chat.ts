import { Router } from 'express';
import { ChatService } from '../services/ai/ChatService';
import { ApiError } from '../middleware/errorHandler';

const router = Router();

// 获取聊天历史
router.get('/:projectId/:versionNumber', async (req, res, next) => {
  try {
    const projectId = Number(req.params.projectId);
    const versionNumber = Number(req.params.versionNumber);
    const sessionId = req.query.sessionId as string;
    
    if (isNaN(projectId) || isNaN(versionNumber)) {
      throw new ApiError('项目ID和版本号必须为数字', 'INVALID_PARAMS', 400);
    }
    
    const chatService = new ChatService();
    const messages = await chatService.getChatHistory(projectId, versionNumber, sessionId);
    
    res.json({
      success: true,
      data: messages
    });
  } catch (error) {
    next(error);
  }
});

// 创建新会话
router.post('/session/:projectId/:versionNumber', async (req, res, next) => {
  try {
    const projectId = Number(req.params.projectId);
    const versionNumber = Number(req.params.versionNumber);
    
    if (isNaN(projectId) || isNaN(versionNumber)) {
      throw new ApiError('项目ID和版本号必须为数字', 'INVALID_PARAMS', 400);
    }
    
    const chatService = new ChatService();
    const sessionId = await chatService.createChatSession(projectId, versionNumber);
    
    res.json({
      success: true,
      data: { sessionId }
    });
  } catch (error) {
    next(error);
  }
});

// 发送消息
router.post('/send', async (req, res, next) => {
  try {
    const { 
      projectId, 
      versionNumber, 
      sessionId, 
      message, 
      parentId, 
      examType, 
      taskType,
      title,
      content
    } = req.body;
    
    if (!projectId || !versionNumber || !sessionId || !message) {
      throw new ApiError('缺少必要参数', 'MISSING_PARAMS', 400);
    }
    
    const chatService = new ChatService();
    const response = await chatService.sendMessage(
      Number(projectId),
      Number(versionNumber),
      sessionId,
      message,
      parentId,
      examType || 'ielts',
      taskType || 'task1',
      title || '',
      content || ''
    );
    
    res.json({
      success: true,
      data: response
    });
  } catch (error) {
    next(error);
  }
});

// 流式发送消息
router.post('/send-stream', async (req, res, next) => {
  try {
    const { 
      projectId, 
      versionNumber, 
      sessionId, 
      message, 
      parentId, 
      examType, 
      taskType,
      title,
      content
    } = req.body;
    
    if (!projectId || !versionNumber || !sessionId || !message) {
      throw new ApiError('缺少必要参数', 'MISSING_PARAMS', 400);
    }
    
    const chatService = new ChatService();
    
    // 使用流式响应，将res对象传给service
    await chatService.sendMessageStream(
      Number(projectId),
      Number(versionNumber),
      sessionId,
      message,
      res,
      parentId,
      examType || 'ielts',
      taskType || 'task1',
      title || '',
      content || ''
    );
    
    // 注意：不需要在这里调用res.json，因为流式响应已经在sendMessageStream中完成
  } catch (error) {
    // 对于流式响应，错误也应该以SSE格式返回
    // 但是如果在此处捕获到错误，说明sendMessageStream没有成功启动
    // 可以直接返回JSON错误
    console.error('流式聊天路由错误:', error);
    
    // 如果响应头尚未设置，则设置为SSE格式
    if (!res.headersSent) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();
      
      // 发送错误消息
      const errorMessage = error instanceof ApiError 
        ? error.message 
        : '发送消息失败，请稍后重试';
      
      res.write(`data: ${JSON.stringify({ type: 'error', error: errorMessage })}\n\n`);
      res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
      res.end();
    } else {
      next(error);
    }
  }
});

// 删除消息
router.delete('/message/:messageId', async (req, res, next) => {
  try {
    const messageId = req.params.messageId;
    
    if (!messageId) {
      throw new ApiError('消息ID不能为空', 'INVALID_PARAMS', 400);
    }
    
    const chatService = new ChatService();
    await chatService.deleteMessage(messageId);
    
    res.json({
      success: true,
      message: '消息已删除'
    });
  } catch (error) {
    next(error);
  }
});

// 删除会话
router.delete('/session/:sessionId', async (req, res, next) => {
  try {
    const sessionId = req.params.sessionId;
    
    if (!sessionId) {
      throw new ApiError('会话ID不能为空', 'INVALID_PARAMS', 400);
    }
    
    const chatService = new ChatService();
    await chatService.deleteSession(sessionId);
    
    res.json({
      success: true,
      message: '会话已删除'
    });
  } catch (error) {
    next(error);
  }
});

// 更新流式聊天日志
router.post('/update-stream-log', async (req, res, next) => {
  try {
    const { 
      requestId, 
      content, 
      rawResponse, 
      tokenUsage 
    } = req.body;
    
    if (!requestId) {
      throw new ApiError('请求ID不能为空', 'INVALID_PARAMS', 400);
    }
    
    const chatService = new ChatService();
    await chatService.updateStreamLog(
      requestId,
      content,
      rawResponse,
      tokenUsage
    );
    
    res.json({
      success: true,
      message: '流式聊天日志已更新'
    });
  } catch (error) {
    next(error);
  }
});

export const chatRouter = router; 