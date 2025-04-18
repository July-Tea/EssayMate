import axios from 'axios';
import { AIConfig, ValidationResult } from '../../../types/api';

export class DoubaoValidator {
  // 使用豆包的官方API地址
  private static readonly API_URL = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';

  /**
   * 验证豆包API密钥是否有效
   * 通过发送一个简单的请求到豆包API来验证密钥
   */
  public async validate(config: AIConfig): Promise<ValidationResult> {
    try {
      console.log('正在验证豆包配置:', JSON.stringify(config, null, 2));
      
      // 检查是否提供了模型名称
      if (!config.model_name || config.model_name.trim() === '') {
        console.log('缺少模型名称，验证失败');
        return {
          isValid: false,
          message: '请提供豆包模型名称',
          code: 'MISSING_MODEL_NAME'
        };
      }
      
      const modelName = config.model_name.trim();
      console.log('使用模型名称:', modelName);
      
      // 构建请求数据
      const requestData = {
        model: modelName,
        messages: [
          { role: 'system', content: '你是人工智能助手.' },
          { role: 'user', content: '你好' }
        ]
      };
      
      console.log('发送请求到豆包API:', JSON.stringify(requestData, null, 2));
      
      // 使用axios调用豆包API
      const response = await axios.post(
        DoubaoValidator.API_URL,
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
        console.log('豆包API验证成功');
        return {
          isValid: true,
          code: 'API_KEY_VALID'
        };
      }
      
      // 如果响应不成功但没有抛出错误，返回无效结果
      console.log('豆包API返回非200状态码:', response.status);
      return {
        isValid: false,
        message: '验证失败，无效的API密钥',
        code: 'INVALID_API_KEY'
      };
    } catch (error: any) {
      console.error('豆包API验证错误:', error);
      
      // 根据不同的错误类型返回不同的错误消息
      if (error.response) {
        // 服务器返回了错误状态码
        const status = error.response.status;
        const errorData = error.response.data;
        console.error('豆包API错误响应:', status, errorData);
        
        if (status === 401 || status === 403) {
          return {
            isValid: false,
            message: 'API密钥未授权，请检查密钥是否正确',
            code: 'UNAUTHORIZED_API_KEY'
          };
        } else {
          return {
            isValid: false,
            message: `豆包API服务器错误 (${status}): ${JSON.stringify(errorData)}`,
            code: 'API_SERVER_ERROR'
          };
        }
      } else if (error.request) {
        // 请求已发出但没有收到响应
        console.error('豆包API无响应:', error.request);
        return {
          isValid: false,
          message: '无法连接到豆包API服务器，请检查网络连接',
          code: 'CONNECTION_ERROR'
        };
      } else {
        // 请求设置时出现错误
        console.error('豆包API请求设置错误:', error.message);
        return {
          isValid: false,
          message: `验证过程发生错误: ${error.message}`,
          code: 'VALIDATION_ERROR'
        };
      }
    }
  }
} 