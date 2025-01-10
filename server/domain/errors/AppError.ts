export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 500,
    public code?: string
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }

  static notFound(message: string): AppError {
    return new AppError(message, 404, 'NOT_FOUND');
  }

  static badRequest(message: string): AppError {
    return new AppError(message, 400, 'BAD_REQUEST');
  }

  static unauthorized(message: string): AppError {
    return new AppError(message, 401, 'UNAUTHORIZED');
  }

  static forbidden(message: string): AppError {
    return new AppError(message, 403, 'FORBIDDEN');
  }

  static internal(message: string, code?: string): AppError {
    return new AppError(message, 500, code || 'INTERNAL_SERVER_ERROR');
  }
}