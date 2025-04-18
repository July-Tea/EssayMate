# EssayMate 后端 API 文档

## 基础信息
- 基础URL: `http://localhost:3000/api`
- 所有响应格式均为 JSON
- 所有请求都需要包含适当的 Content-Type header: `application/json`

## 1. 认证相关 API (`/auth`)

### 1.1 验证API密钥
- **路径**: `/api/auth/validate`
- **方法**: POST
- **请求体**:
  ```json
  {
    "model": "string",
    "apiKey": "string"
  }
  ```
- **响应**:
  ```json
  {
    "success": true,
    "data": {
      // 验证结果
    }
  }
  ```

## 2. 项目相关 API (`/projects`)

### 2.1 创建新项目
- **路径**: `/api/projects`
- **方法**: POST
- **请求体**: ProjectCreate 对象
- **响应**: 创建的项目信息

### 2.2 获取所有项目
- **路径**: `/api/projects`
- **方法**: GET
- **响应**: 项目列表，包含最新反馈信息

### 2.3 获取单个项目
- **路径**: `/api/projects/:id`
- **方法**: GET
- **响应**: 项目详情，包含所有版本和反馈

### 2.4 创建新版本
- **路径**: `/api/projects/:id/versions`
- **方法**: POST
- **请求体**: EssayVersionCreate 对象
- **响应**: 新创建的版本信息

### 2.5 创建反馈
- **路径**: `/api/projects/:id/versions/:versionNumber/feedback`
- **方法**: POST
- **请求体**: FeedbackCreate 对象
- **响应**: 创建的反馈信息

### 2.6 更新反馈状态
- **路径**: `/api/projects/:id/versions/:versionNumber/feedback/status`
- **方法**: PATCH
- **请求体**:
  ```json
  {
    "status": "string"
  }
  ```
- **响应**: 更新后的状态信息

### 2.7 删除项目（软删除）
- **路径**: `/api/projects/:id/delete`
- **方法**: PATCH
- **响应**: 删除操作结果

### 2.8 更新项目
- **路径**: `/api/projects/:id`
- **方法**: PUT
- **请求体**: 项目更新数据
- **响应**: 更新后的项目信息

## 3. AI 相关 API (`/ai`)

### 3.1 生成作文反馈
- **路径**: `/api/ai/feedback`
- **方法**: POST
- **请求体**:
  ```json
  {
    "essay": "string",
    "model": "string",
    "apiKey": "string"
  }
  ```
- **响应**: AI生成的反馈信息

### 3.2 生成作文改进建议
- **路径**: `/api/ai/improvement`
- **方法**: POST
- **请求体**:
  ```json
  {
    "essay": "string",
    "model": "string",
    "apiKey": "string"
  }
  ```
- **响应**: AI生成的改进建议

## 4. AI反馈相关 API (`/ai-feedback`)

### 4.1 生成批改
- **路径**: `/api/ai-feedback/projects/:projectId/versions/:versionNumber/generate/:model?`
- **方法**: POST
- **响应**: 批改结果

### 4.2 使用当前活跃模型批改
- **路径**: `/api/ai-feedback/projects/:projectId/versions/:versionNumber/generate-model`
- **方法**: POST
- **响应**: 批改结果
- **注意**: 此API已废弃，请使用4.1中的通用批改API

### 4.3 使用豆包模型批改（兼容旧版）
- **路径**: `/api/ai-feedback/projects/:projectId/versions/:versionNumber/generate-doubao`
- **方法**: POST
- **响应**: 批改结果
- **注意**: 此API已废弃，请使用4.1中的通用批改API，并指定model='doubao'

### 4.4 获取批改状态
- **路径**: `/api/ai-feedback/status/:feedbackId`
- **方法**: GET
- **响应**: 批改状态信息

### 4.5 获取批改进度
- **路径**: `/api/ai-feedback/progress/:feedbackId`
- **方法**: GET
- **响应**:
  ```json
  {
    "success": true,
    "data": {
      "currentStage": "string", // FEEDBACK, ANNOTATION, EXAMPLE_ESSAY, NONE
      "totalItems": number,     // 总项目数
      "currentItem": number,    // 当前项目
      "status": "string"        // 批改状态
    }
  }
  ```

### 4.6 生成范文
- **路径**: `/api/ai-feedback/projects/:projectId/versions/:versionNumber/example-essay/:model?`
- **方法**: POST
- **请求体**:
  ```json
  {
    "prompt": "string",       // 作文题目（必填）
    "examType": "string",     // 考试类型（如 'IELTS', 'TOEFL'）
    "examCategory": "string", // 考试类别（如 'task1', 'task2'）
    "targetScore": "string",  // 目标分数
    "essayContent": "string" // 学生原文（可选，用于生成改进建议）
  }
  ```
- **响应**:
  ```json
  {
    "success": true,
    "data": {
      "exampleContent": "string", // 生成的范文内容
      "improvement": "string",   // 针对学生原文的改进建议（可选）
      "wordCount": number,     // 范文字数
      "tokenUsage": {          // Token使用情况（可选）
        "promptTokens": number,
        "completionTokens": number,
        "totalTokens": number
      }
    }
  }
  ```

### 4.7 单独生成范文（不关联项目）
- **路径**: `/api/ai-feedback/example-essay/:model?`
- **方法**: POST
- **请求体**:
  ```json
  {
    "prompt": "string",       // 作文题目（必填）
    "examType": "string",     // 考试类型（如 'IELTS', 'TOEFL'）
    "examCategory": "string", // 考试类别（如 'task1', 'task2'）
    "targetScore": "string",  // 目标分数
    "essayContent": "string" // 学生原文（可选，用于生成改进建议）
  }
  ```
- **响应**:
  ```json
  {
    "success": true,
    "data": {
      "exampleContent": "string", // 生成的范文内容
      "improvement": "string",   // 针对学生原文的改进建议（可选）
      "wordCount": number,     // 范文字数
      "tokenUsage": {          // Token使用情况（可选）
        "promptTokens": number,
        "completionTokens": number,
        "totalTokens": number
      }
    }
  }
  ```

## 5. 配置相关 API (`/config`)

### 5.1 获取当前活动配置
- **路径**: `/api/config/active`
- **方法**: GET
- **响应**: 当前活动的配置信息

### 5.2 获取所有配置
- **路径**: `/api/config`
- **方法**: GET
- **响应**: 所有配置列表

### 5.3 获取指定模型配置
- **路径**: `/api/config/:model`
- **方法**: GET
- **响应**: 指定模型的配置信息

### 5.4 保存新配置
- **路径**: `/api/config`
- **方法**: POST
- **请求体**: AIConfig 对象
- **响应**: 保存的配置信息

### 5.5 激活配置
- **路径**: `/api/config/activate/:id`
- **方法**: POST
- **响应**: 激活后的配置信息

### 5.6 删除配置
- **路径**: `/api/config/:id`
- **方法**: DELETE
- **响应**: 删除操作结果

### 5.7 获取数据库信息
- **路径**: `/api/config/database/tables`
- **方法**: GET
- **响应**: 数据库表结构和数据信息

## 6. 日志相关 API (`/logs`)

### 6.1 获取日志列表
- **路径**: `/api/logs`
- **方法**: GET
- **响应**: 日志列表

### 6.2 获取日志统计信息
- **路径**: `/api/logs/stats`
- **方法**: GET
- **响应**: 日志统计信息

### 6.3 获取服务类型列表
- **路径**: `/api/logs/service-types`
- **方法**: GET
- **响应**: 服务类型列表

### 6.4 获取模型名称列表
- **路径**: `/api/logs/model-names`
- **方法**: GET
- **响应**: 模型名称列表

### 6.5 获取日志详情
- **路径**: `/api/logs/:id`
- **方法**: GET
- **响应**: 指定日志的详细信息

## 7. 健康检查
- **路径**: `/health`
- **方法**: GET
- **响应**: 
  ```json
  {
    "status": "ok"
  }
  ```

## 错误处理
所有API在发生错误时会返回统一格式的错误响应：
```json
{
  "success": false,
  "error": {
    "message": "错误信息",
    "code": "错误代码",
    "status": 状态码
  }
}
```

## 注意事项
1. 所有请求都需要进行适当的错误处理
2. API响应都包含 `success` 字段表示操作是否成功
3. 部分API需要认证信息（model和apiKey）
4. 文件上传大小限制为50MB
5. 所有时间戳使用ISO 8601格式 