import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '../types/api';

export class ApiError extends Error {
  constructor(
    message: string,
    public code: string = 'UNKNOWN_ERROR',
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const errorHandler = (
  err: ApiError | Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const statusCode = (err as ApiError).statusCode || 400;
  const code = (err as ApiError).code || 'UNKNOWN_ERROR';
  const message = err.message || '服务器内部错误';

  const response: ApiResponse<never> = {
    success: false,
    error: {
      code,
      message
    }
  };

  res.status(statusCode).json(response);
};