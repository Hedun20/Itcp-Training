import type { RequestHandler } from 'express';
import type { ZodTypeAny } from 'zod';
import { AppError } from '../utils/AppError';

type RequestSchemas = Partial<Record<'body' | 'params' | 'query', ZodTypeAny>>;

export function validate(schemas: RequestSchemas): RequestHandler {
  return (request, _response, next) => {
    for (const key of ['body', 'params', 'query'] as const) {
      const schema = schemas[key];
      if (!schema) continue;
      const result = schema.safeParse(request[key]);
      if (!result.success) {
        return next(
          new AppError(422, 'VALIDATION_ERROR', 'Request validation failed', result.error.flatten()),
        );
      }
      (request as any)[key] = result.data;
    }
    next();
  };
}
