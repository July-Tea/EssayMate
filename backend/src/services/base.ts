import { ApiResponse } from '../types/api';
import { ApiError } from '../middleware/errorHandler';

export abstract class BaseService {
  protected formatResponse<T>(data: T): ApiResponse<T> {
    return {
      success: true,
      data
    };
  }

  protected formatError(error: Error): ApiResponse<never> {
    return {
      success: false,
      error: {
        code: error instanceof ApiError ? error.code : 'UNKNOWN_ERROR',
        message: error.message
      }
    };
  }
} 