import { model, Schema, type Model, type Types } from 'mongoose';

export const AUDIT_ACTIONS = [
  'course.created',
  'course.updated',
  'course.published',
  'course.unpublished',
  'course.archived',
  'media.uploaded',
  'media.deleted',
  'instructor.registered',
  'user.role_changed',
  'user.status_changed',
] as const;

export interface IAuditLog {
  _id: Types.ObjectId;
  actorId: Types.ObjectId;
  action: (typeof AUDIT_ACTIONS)[number];
  targetType: 'course' | 'media' | 'user';
  targetId: Types.ObjectId;
  metadata?: Record<string, unknown>;
  requestId?: string;
  ip?: string;
  createdAt: Date;
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    actorId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    action: { type: String, enum: AUDIT_ACTIONS, required: true, index: true },
    targetType: { type: String, enum: ['course', 'media', 'user'], required: true },
    targetId: { type: Schema.Types.ObjectId, required: true, index: true },
    metadata: { type: Schema.Types.Mixed },
    requestId: String,
    ip: String,
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);

export const AuditLog: Model<IAuditLog> = model<IAuditLog>('AuditLog', auditLogSchema);
