/**
 * 并发任务管理器
 * 管理任务队列，控制并发数量，提供任务执行和结果收集
 */
export class ConcurrentTaskManager<T> {
  private maxConcurrency: number;
  private runningTasks: Set<Promise<T>> = new Set();
  private taskQueue: Array<() => Promise<T>> = [];
  private results: Map<string, T> = new Map();
  private errors: Map<string, Error> = new Map();

  constructor(maxConcurrency: number = 10) {
    this.maxConcurrency = maxConcurrency;
  }

  /**
   * 添加任务到队列
   * @param taskId 任务唯一标识
   * @param taskFn 任务执行函数
   */
  addTask(taskId: string, taskFn: () => Promise<T>): void {
    const wrappedTask = async (): Promise<T> => {
      try {
        const result = await taskFn();
        this.results.set(taskId, result);
        return result;
      } catch (error) {
        this.errors.set(taskId, error as Error);
        throw error;
      }
    };

    this.taskQueue.push(wrappedTask);
  }

  /**
   * 执行所有任务
   * @returns Promise<void>
   */
  async executeAll(): Promise<void> {
    while (this.taskQueue.length > 0 || this.runningTasks.size > 0) {
      // 启动新任务直到达到并发限制
      while (this.runningTasks.size < this.maxConcurrency && this.taskQueue.length > 0) {
        const task = this.taskQueue.shift()!;
        const runningTask = task().finally(() => {
          this.runningTasks.delete(runningTask);
        });
        this.runningTasks.add(runningTask);
      }

      // 等待至少一个任务完成
      if (this.runningTasks.size > 0) {
        try {
          await Promise.race(this.runningTasks);
        } catch (error) {
          // 忽略单个任务的错误，让其他任务继续执行
          // 错误已经在 wrappedTask 中被记录
        }
      }
    }
  }

  /**
   * 获取任务结果
   * @param taskId 任务ID
   * @returns 任务结果或undefined
   */
  getResult(taskId: string): T | undefined {
    return this.results.get(taskId);
  }

  /**
   * 获取任务错误
   * @param taskId 任务ID
   * @returns 任务错误或undefined
   */
  getError(taskId: string): Error | undefined {
    return this.errors.get(taskId);
  }

  /**
   * 获取所有结果
   * @returns 所有任务结果的Map
   */
  getAllResults(): Map<string, T> {
    return new Map(this.results);
  }

  /**
   * 获取所有错误
   * @returns 所有任务错误的Map
   */
  getAllErrors(): Map<string, Error> {
    return new Map(this.errors);
  }

  /**
   * 清理资源
   */
  clear(): void {
    this.results.clear();
    this.errors.clear();
    this.taskQueue.length = 0;
    this.runningTasks.clear();
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    totalTasks: number;
    completedTasks: number;
    failedTasks: number;
    runningTasks: number;
    queuedTasks: number;
  } {
    return {
      totalTasks: this.results.size + this.errors.size + this.runningTasks.size + this.taskQueue.length,
      completedTasks: this.results.size,
      failedTasks: this.errors.size,
      runningTasks: this.runningTasks.size,
      queuedTasks: this.taskQueue.length
    };
  }
}
