import type { RequestHandler } from 'express';
import { AppError } from '../utils/AppError';

export const notFound: RequestHandler = (request, _response, next) => {
  next(new AppError(404, 'NOT_FOUND', `Route ${request.method} ${request.originalUrl} was not found`));
};
