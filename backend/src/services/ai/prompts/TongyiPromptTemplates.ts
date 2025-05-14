/**
 * Tongyi模型提示词模板导出文件
 * 从各个具体的模板文件导入并重新导出
 */
import { PromptConfig } from './PromptTemplate';

// 雅思Task1模板
import IELTSTask1Feedback from './models/Tongyi/ielts/task1/feedback';
import IELTSTask1Annotation from './models/Tongyi/ielts/task1/annotation';
import { exampleEssayPrompt as IELTSTask1Example } from './models/Tongyi/ielts/task1/example';
import { feedbackPrompt as IELTSTask1Chat } from './models/Tongyi/ielts/task1/chat';

// 雅思Task2模板
import IELTSTask2Feedback from './models/Tongyi/ielts/task2/feedback';
import IELTSTask2Annotation from './models/Tongyi/ielts/task2/annotation';
import { exampleEssayPrompt as IELTSTask2Example } from './models/Tongyi/ielts/task2/example';
import { feedbackPrompt as IELTSTask2Chat } from './models/Tongyi/ielts/task2/chat';

// 托福模板
import TOEFLFeedback from './models/Tongyi/toefl/feedback';
import TOEFLAnnotation from './models/Tongyi/toefl/annotation';
import { exampleEssayPrompt as TOEFLExample } from './models/Tongyi/toefl/example';

// 导出所有模板
export {
  // 雅思Task1
  IELTSTask1Feedback,
  IELTSTask1Annotation,
  IELTSTask1Example,
  IELTSTask1Chat,
  
  // 雅思Task2
  IELTSTask2Feedback,
  IELTSTask2Annotation,
  IELTSTask2Example,
  IELTSTask2Chat,
  
  // 托福
  TOEFLFeedback,
  TOEFLAnnotation,
  TOEFLExample
};

/**
 * 获取模板路径
 * @param model 模型名称
 * @param examType 考试类型
 * @param taskType 任务类型
 * @param promptType 提示词类型
 * @returns 模板路径
 */
export function getTemplateModulePath(
  model: string,
  examType: string,
  taskType: string,
  promptType: string
): string {
  return `./models/${model.toLowerCase()}/${examType.toLowerCase()}/${taskType.toLowerCase()}/${promptType.toLowerCase()}`;
} 