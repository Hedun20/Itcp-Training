import type { Request } from 'express';
import { Types } from 'mongoose';
import { AuditLog, type IAuditLog } from '../models/AuditLog';

export async function recordAudit(
  request: Request,
  action: IAuditLog['action'],
  targetType: IAuditLog['targetType'],
  targetId: Types.ObjectId | string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  if (!request.auth) return;
  await AuditLog.create({
    actorId: request.auth.userId,
    action,
    targetType,
    targetId,
    metadata,
    requestId: request.requestId,
    ip: request.ip,
  });
}

export async function recordInstructorRegistration(
  request: Request,
  userId: Types.ObjectId | string,
  method: 'password' | 'google',
): Promise<void> {
  await AuditLog.create({
    actorId: userId,
    action: 'instructor.registered',
    targetType: 'user',
    targetId: userId,
    metadata: { method },
    requestId: request.requestId,
    ip: request.ip,
  });
}
