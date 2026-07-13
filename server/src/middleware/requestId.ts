import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';

const validRequestId = /^[A-Za-z0-9._-]{1,100}$/;

export const requestId: RequestHandler = (request, response, next) => {
  const incoming = request.header('x-request-id');
  request.requestId = incoming && validRequestId.test(incoming) ? incoming : randomUUID();
  response.setHeader('x-request-id', request.requestId);
  next();
};
