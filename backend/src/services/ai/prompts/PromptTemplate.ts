/**
 * 提示词模板类型定义
 */
export interface PromptTemplateData {
  [key: string]: any;
}

/**
 * 提示词配置
 */
export interface PromptConfig {
  /**
   * 系统提示词模板
   */
  systemPrompt: string;
  
  /**
   * 用户提示词模板
   */
  userPrompt: string;
  
  /**
   * 需要保留的最大token数量
   * 用于控制是否需要截断内容以节省token
   */
  maxTokens?: number;
  
  /**
   * 输出格式设置
   * JSON或TEXT
   */
  outputFormat?: 'json' | 'text';
}

/**
 * 提示词模板引擎
 * 用于根据模板和数据生成实际的提示词
 */
export class PromptTemplate {
  private template: PromptConfig;
  
  /**
   * 构造函数
   * @param template 提示词模板配置
   */
  constructor(template: PromptConfig) {
    this.template = template;
  }
  
  /**
   * 渲染提示词
   * @param data 模板数据
   * @returns 渲染后的系统提示词和用户提示词
   */
  render(data: PromptTemplateData): { systemMessage: string, userMessage: string } {
    const systemMessage = this.renderTemplate(this.template.systemPrompt, data);
    const userMessage = this.renderTemplate(this.template.userPrompt, data);
    
    return { systemMessage, userMessage };
  }
  
  /**
   * 渲染单个模板
   * @param template 模板字符串
   * @param data 模板数据
   * @returns 渲染后的字符串
   */
  private renderTemplate(template: string, data: PromptTemplateData): string {
    let rendered = template;
    
    // 替换所有变量 {{variable}}
    const variableRegex = /\{\{([^}]+)\}\}/g;
    rendered = rendered.replace(variableRegex, (match, key) => {
      const trimmedKey = key.trim();
      return data[trimmedKey] !== undefined ? String(data[trimmedKey]) : match;
    });
    
    // 处理条件块 {{#if condition}} content {{/if}}
    const conditionRegex = /\{\{#if\s+([^}]+)\}\}([\s\S]*?)\{\{\/if\}\}/g;
    rendered = rendered.replace(conditionRegex, (match, condition, content) => {
      const trimmedCondition = condition.trim();
      return data[trimmedCondition] ? content : '';
    });
    
    // 处理循环块 {{#each items}} {{item}} {{/each}}
    const loopRegex = /\{\{#each\s+([^}]+)\}\}([\s\S]*?)\{\{\/each\}\}/g;
    rendered = rendered.replace(loopRegex, (match, arrayName, content) => {
      const trimmedArrayName = arrayName.trim();
      const array = data[trimmedArrayName];
      
      if (!Array.isArray(array)) {
        return '';
      }
      
      return array.map(item => {
        let itemContent = content;
        // 在循环内支持 {{item}} 变量
        return itemContent.replace(/\{\{item\}\}/g, String(item));
      }).join('');
    });
    
    return rendered;
  }
  
  /**
   * 估算模板渲染后的token数量
   * 非常粗略的估算，仅用于快速判断
   * @param data 模板数据
   * @returns 估算的token数量
   */
  estimateTokenCount(data: PromptTemplateData): number {
    const { systemMessage, userMessage } = this.render(data);
    // 粗略估算：平均每4个字符约为1个token
    return Math.ceil((systemMessage.length + userMessage.length) / 4);
  }
  
  /**
   * 获取模板配置
   */
  getConfig(): PromptConfig {
    return this.template;
  }
  
  /**
   * 设置模板配置
   * @param config 新的模板配置
   */
  setConfig(config: PromptConfig): void {
    this.template = config;
  }
} 