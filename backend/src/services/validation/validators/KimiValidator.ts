import axios from 'axios';
import { AIConfig, ValidationResult } from '../../../types/api';

export class KimiValidator {
  // 使用Moonshot API的官方API地址
  private static readonly API_URL = 'https://api.moonshot.cn/v1/chat/completions';
  // 默认使用的模型
  private static readonly DEFAULT_MODEL = 'moonshot-v1-8k';

  /**
   * 验证Kimi API密钥是否有效
   * 通过发送一个简单的请求到Moonshot API来验证密钥
   */
  public async validate(config: AIConfig): Promise<ValidationResult> {
    try {
      console.log('正在验证Kimi配置:', JSON.stringify(config, null, 2));
      
      // 使用配置中的模型名称或默认模型
      const modelName = config.model_name || KimiValidator.DEFAULT_MODEL;
      console.log('使用模型:', modelName);
      
      // 构建请求数据
      const requestData = {
        model: modelName,
        messages: [
          { "role": "system", "content": "你是 Kimi，由 Moonshot AI 提供的人工智能助手，你更擅长中文和英文的对话。" },
          { "role": "user", "content": "你好" }
        ],
        temperature: 0.3
      };
      
      console.log('发送请求到Moonshot API:', JSON.stringify(requestData, null, 2));
      
      // 使用axios调用Moonshot API
      const response = await axios.post(
        KimiValidator.API_URL,
        requestData,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey}`
          },
          timeout: 5000 // 设置超时时间为5秒
        }
      );
      
      // 如果能够成功收到响应，则密钥有效
      if (response.status === 200) {
        console.log('Moonshot API验证成功');
        return {
          isValid: true,
          code: 'API_KEY_VALID'
        };
      }
      
      // 如果响应不成功但没有抛出错误，返回无效结果
      console.log('Moonshot API返回非200状态码:', response.status);
      return {
        isValid: false,
        message: '验证失败，无效的API密钥',
        code: 'INVALID_API_KEY'
      };
    } catch (error: any) {
      console.error('Moonshot API验证错误:', error);
      
      // 根据不同的错误类型返回不同的错误消息
      if (error.response) {
        // 服务器返回了错误状态码
        const status = error.response.status;
        const errorData = error.response.data;
        console.error('Moonshot API错误响应:', status, errorData);
        
        if (status === 401 || status === 403) {
          return {
            isValid: false,
            message: 'API密钥未授权，请检查密钥是否正确',
            code: 'UNAUTHORIZED_API_KEY'
          };
        } else {
          return {
            isValid: false,
            message: `Moonshot API服务器错误 (${status}): ${JSON.stringify(errorData)}`,
            code: 'API_SERVER_ERROR'
          };
        }
      } else if (error.request) {
        // 请求已发出但没有收到响应
        console.error('Moonshot API无响应:', error.request);
        return {
          isValid: false,
          message: '无法连接到Moonshot API服务器，请检查网络连接',
          code: 'CONNECTION_ERROR'
        };
      } else {
        // 请求设置时出现错误
        console.error('Moonshot API请求设置错误:', error.message);
        return {
          isValid: false,
          message: `验证过程发生错误: ${error.message}`,
          code: 'VALIDATION_ERROR'
        };
      }
    }
  }
} 