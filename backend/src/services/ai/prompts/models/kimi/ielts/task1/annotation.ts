/**
 * Kimi - 雅思 - 任务1 - 段落批注Prompt模板
 */
import { PromptConfig } from '../../../../PromptTemplate';

const annotationPrompt: PromptConfig = {
  systemPrompt: `请为以下雅思Task 1作文的段落生成精确的批注和修改建议。

针对雅思Task 1，专注于以下几点：
1. 描述图表/图形数据的准确性和完整性
2. 趋势词汇使用的多样性和准确性
3. 关键数据的比较和对比表达
4. 是否保持客观描述而非主观分析
5. 语法错误和不恰当的表达
6. 不准确或过于简单的词汇选择

雅思Task 1的段落应该：
- 清晰描述图表/图形中的主要趋势和特征
- 使用适当的数据描述词汇和变化趋势词汇
- 准确引用关键数据点进行比较
- 保持客观描述，避免个人观点
- 使用适当的图表描述语言和结构

你的回复必须是一个JSON数组，每个批注包含以下字段：
- type: 批注类型，可选值为"suggestion"（建议）、"correction"（修正）或"highlight"（高亮）
- original_content: 原文中需要修改的文本内容。必须是段落中的精确文字片段，而非总结或描述。系统将根据这个文本在原文中进行匹配，所以必须一字不差地从段落中复制。
- correction_content: 修正后的文本内容（仅当type为correction时，需要提供完整修正后的句子）
- suggestion: 具体的修改建议和解释

请确保：
1. 每条批注都指向段落中的具体文本片段
2. original_content字段必须是段落中的原文精确片段，不可添加或更改任何文字，系统将用它精确匹配原文位置
3. 批注类型恰当（对严重错误使用correction，对可改进处使用suggestion）
4. 每个批注都有明确、具体的修改建议

示例格式：
[
  {
    "type": "correction",
    "original_content": "The chart shows the increase of population",
    "correction_content": "The chart illustrates the population growth",
    "suggestion": "使用'illustrates'替代'shows'更符合学术写作风格，'population growth'比'increase of population'更简洁"
  },
  {
    "type": "suggestion",
    "original_content": "went up",
    "correction_content": "increased significantly",
    "suggestion": "使用'increased significantly'或'rose substantially'等更精确的表达替代简单的'went up'"
  }
]

重要提示：original_content字段必须完全匹配原文中的片段，不要编造或总结。如果找不到合适的短语来改进，请选择包含问题的完整句子作为original_content。

请控制批注数量在3-6个，聚焦最重要的改进点。`,

  userPrompt: `段落内容：
{{content}}

{{#if feedback}}
整体评分反馈：{{feedback}}
{{/if}}

{{#if targetScore}}
目标分数：{{targetScore}}
请提供能帮助学生达到这个目标分数的针对性批注。
{{/if}}

请生成JSON格式的批注数组，确保original_content字段能在段落内容中精确匹配。必须从原文直接复制片段，而不是描述问题。批注应聚焦在雅思Task 1作文的关键问题上。`,

  maxTokens: 2000,
  outputFormat: 'json'
};

export default annotationPrompt; 