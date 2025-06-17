import { IELTSFeedbackService, IELTSFeedbackRequest } from '../services/ai/IELTSFeedbackService';
import { Annotation } from '../models/Feedback';

/**
 * 基础任务接口
 */
export interface BaseTask<T> {
  taskId: string;
  taskType: string;
  execute(): Promise<T>;
}

/**
 * 反馈任务结果
 */
export interface FeedbackTaskResult {
  scoreTR: number;
  scoreCC: number;
  scoreLR: number;
  scoreGRA: number;
  feedbackTR: string;
  feedbackCC: string;
  feedbackLR: string;
  feedbackGRA: string;
  overallFeedback: string;
}

/**
 * 批注任务结果
 */
export interface AnnotationTaskResult {
  paragraphIndex: number;
  annotations: Annotation[];
}

/**
 * 范文任务结果
 */
export interface ExampleEssayTaskResult {
  exampleContent: string;
  improvement?: string;
  wordCount: number;
  tokenUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * 反馈任务 - 获取评分和反馈
 */
export class FeedbackTask implements BaseTask<FeedbackTaskResult> {
  public readonly taskId: string;
  public readonly taskType: string = 'FEEDBACK';

  constructor(
    private feedbackService: IELTSFeedbackService,
    private request: IELTSFeedbackRequest,
    private projectId: number,
    private versionNumber: string
  ) {
    this.taskId = `feedback_${projectId}_${versionNumber}`;
  }

  async execute(): Promise<FeedbackTaskResult> {
    console.log(`[并发任务] [${this.taskId}] 开始执行反馈任务`);
    
    try {
      const result = await this.feedbackService.getFeedback(this.request);
      
      console.log(`[并发任务] [${this.taskId}] 反馈任务完成`);
      
      return {
        scoreTR: result.scoreTR,
        scoreCC: result.scoreCC,
        scoreLR: result.scoreLR,
        scoreGRA: result.scoreGRA,
        feedbackTR: result.feedbackTR,
        feedbackCC: result.feedbackCC,
        feedbackLR: result.feedbackLR,
        feedbackGRA: result.feedbackGRA,
        overallFeedback: result.overallFeedback,

      };
    } catch (error) {
      console.error(`[并发任务] [${this.taskId}] 反馈任务失败:`, error);
      throw error;
    }
  }
}

/**
 * 批注任务 - 获取段落批注
 */
export class AnnotationTask implements BaseTask<AnnotationTaskResult> {
  public readonly taskId: string;
  public readonly taskType: string = 'ANNOTATION';

  constructor(
    private feedbackService: IELTSFeedbackService,
    private paragraph: string,
    private paragraphIndex: number,
    private context: {
      allParagraphs: string[];
      feedback?: string;
      targetScore?: string;
      essayType?: string;
      projectId: string;
      versionNumber: string | undefined;
    }
  ) {
    this.taskId = `annotation_${context.projectId}_${context.versionNumber}_${paragraphIndex}`;
  }

  async execute(): Promise<AnnotationTaskResult> {
    console.log(`[并发任务] [${this.taskId}] 开始执行批注任务 段落${this.paragraphIndex + 1}/${this.context.allParagraphs.length}`);
    
    try {
      const annotations = await this.feedbackService.getAnnotation(this.paragraph, {
        paragraphIndex: this.paragraphIndex,
        allParagraphs: this.context.allParagraphs,
        feedback: this.context.feedback,
        targetScore: this.context.targetScore,
        essayType: this.context.essayType,
        projectId: this.context.projectId,
        versionNumber: this.context.versionNumber
      });
      
      console.log(`[并发任务] [${this.taskId}] 批注任务完成，获取到 ${annotations.length} 条批注`);
      
      return {
        paragraphIndex: this.paragraphIndex,
        annotations: annotations || []
      };
    } catch (error) {
      console.error(`[并发任务] [${this.taskId}] 批注任务失败:`, error);
      throw error;
    }
  }
}

/**
 * 范文任务 - 生成范文
 */
export class ExampleEssayTask implements BaseTask<ExampleEssayTaskResult> {
  public readonly taskId: string;
  public readonly taskType: string = 'EXAMPLE_ESSAY';

  constructor(
    private feedbackService: IELTSFeedbackService,
    private prompt: string,
    private context: {
      examType?: string;
      examCategory?: string;
      targetScore?: string;
      projectId?: number;
      versionNumber?: number;
      essayContent?: string;
    }
  ) {
    this.taskId = `example_${context.projectId || 'standalone'}_${context.versionNumber || 'standalone'}`;
  }

  async execute(): Promise<ExampleEssayTaskResult> {
    console.log(`[并发任务] [${this.taskId}] 开始执行范文任务`);
    
    try {
      const result = await this.feedbackService.getExampleEssay(this.prompt, this.context);
      
      console.log(`[并发任务] [${this.taskId}] 范文任务完成，字数: ${result.wordCount}`);
      
      return {
        exampleContent: result.exampleContent,
        improvement: result.improvement,
        wordCount: result.wordCount,
        tokenUsage: result.tokenUsage
      };
    } catch (error) {
      console.error(`[并发任务] [${this.taskId}] 范文任务失败:`, error);
      throw error;
    }
  }
}
