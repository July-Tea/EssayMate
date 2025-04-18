import express from 'express';
import cors from 'cors';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { authRouter } from './routes/auth';
import { projectRouter } from './routes/project';
import { aiRouter } from './routes/ai';
import { aiFeedbackRouter } from './routes/aiFeedback';
import { exampleEssayRouter } from './routes/exampleEssay';
import { default as configRouter } from './routes/config';
import { default as logsRouter } from './routes/logs';
import { initializeDatabase } from './data-source';

const app = express();

// 中间件配置
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(requestLogger);

// 路由配置
app.use('/api/auth', authRouter);
app.use('/api/projects', projectRouter);
app.use('/api/ai', aiRouter);
app.use('/api/ai-feedback', aiFeedbackRouter);
app.use('/api/example-essays', exampleEssayRouter);
app.use('/api/config', configRouter);
app.use('/api/logs', logsRouter);

// 错误处理
app.use(errorHandler);

// 健康检查端点
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 3000;

// 启动服务器
if (require.main === module) {
  const startServer = async () => {
    try {
      await initializeDatabase();
      app.listen(PORT, () => {
        console.log(`后端服务器运行在: http://localhost:${PORT}`);
        console.log(`健康检查: http://localhost:${PORT}/health`);
      });
    } catch (error) {
      console.error('服务器启动失败:', error);
      process.exit(1);
    }
  };

  startServer();
}

export default app;