import type { ErrorRequestHandler } from 'express';
import { MulterError } from 'multer';
import { ZodError } from 'zod';
import { AppError } from '../utils/AppError';

function mongoError(error: any): AppError | undefined {
  if (error?.code === 11000) {
    return new AppError(409, 'CONFLICT', 'A record with that value already exists', error.keyValue);
  }
  if (error?.name === 'CastError') return new AppError(404, 'NOT_FOUND', 'Resource not found');
  if (error?.name === 'ValidationError') {
    return new AppError(422, 'VALIDATION_ERROR', 'Stored data validation failed', error.errors);
  }
  return undefined;
}

export const errorHandler: ErrorRequestHandler = (error, request, response, _next) => {
  let appError = error instanceof AppError ? error : mongoError(error);

  if (error?.type === 'entity.too.large') {
    appError = new AppError(413, 'PAYLOAD_TOO_LARGE', 'Request body exceeds the configured size limit');
  } else if (error?.type === 'entity.parse.failed') {
    appError = new AppError(400, 'INVALID_JSON', 'Request body contains invalid JSON');
  } else if (error instanceof MulterError) {
    appError = new AppError(
      error.code === 'LIMIT_FILE_SIZE' ? 413 : 422,
      'UPLOAD_ERROR',
      error.code === 'LIMIT_FILE_SIZE' ? 'Image exceeds the configured maximum size' : error.message,
    );
  } else if (error instanceof ZodError) {
    appError = new AppError(422, 'VALIDATION_ERROR', 'Request validation failed', error.flatten());
  } else if (!appError && Number.isInteger(error?.status) && error.status >= 400 && error.status < 500) {
    appError = new AppError(error.status, error.status === 404 ? 'NOT_FOUND' : 'BAD_REQUEST', error.status === 404 ? 'Resource not found' : 'Request could not be processed');
  }

  const status = appError?.status ?? 500;
  if (status >= 500 && process.env.NODE_ENV !== 'test') {
    console.error(`[${request.requestId}]`, error);
  }

  response.status(status).json({
    error: {
      code: appError?.code ?? 'INTERNAL_ERROR',
      message: appError?.message ?? 'An unexpected error occurred',
      ...(appError?.details === undefined ? {} : { details: appError.details }),
      requestId: request.requestId,
    },
  });
};
