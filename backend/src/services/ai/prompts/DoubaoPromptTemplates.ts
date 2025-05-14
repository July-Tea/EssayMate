/**
 * 豆包Prompt模板索引
 * 统一导出所有豆包模型相关的Prompt模板
 */

// 雅思Task1模板
import { feedbackPrompt as IELTSTask1Feedback } from './models/doubao/ielts/task1/feedback';
import { annotationPrompt as IELTSTask1Annotation } from './models/doubao/ielts/task1/annotation';
import { exampleEssayPrompt as IELTSTask1Example } from './models/doubao/ielts/task1/example';
import { feedbackPrompt as IELTSTask1Chat } from './models/doubao/ielts/task1/chat';

// 雅思Task2模板
import { feedbackPrompt as IELTSTask2Feedback } from './models/doubao/ielts/task2/feedback';
import { annotationPrompt as IELTSTask2Annotation } from './models/doubao/ielts/task2/annotation';
import { exampleEssayPrompt as IELTSTask2Example } from './models/doubao/ielts/task2/example';
import { feedbackPrompt as IELTSTask2Chat } from './models/doubao/ielts/task2/chat';

// 托福模板
import { exampleEssayPrompt as TOEFLExample } from './models/doubao/toefl/example';
// import { feedbackPrompt as TOEFLFeedback } from './models/doubao/toefl/feedback';
// import { annotationPrompt as TOEFLAnnotation } from './models/doubao/toefl/annotation';

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
  TOEFLExample,
  // TOEFLFeedback,
  // TOEFLAnnotation
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