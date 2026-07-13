import { model, Schema, type HydratedDocument, type Model, type Types } from 'mongoose';

export const PROGRESS_STATUSES = ['not_started', 'in_progress', 'completed'] as const;

export interface ICourseProgress {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  courseId: Types.ObjectId;
  status: (typeof PROGRESS_STATUSES)[number];
  currentModuleIndex: number;
  completedModuleIds: Types.ObjectId[];
  startedAt?: Date;
  lastAccessedAt?: Date;
  completedAt?: Date;
  bestScore?: number;
  passed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type CourseProgressDocument = HydratedDocument<ICourseProgress>;

const courseProgressSchema = new Schema<ICourseProgress>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    status: { type: String, enum: PROGRESS_STATUSES, default: 'not_started', required: true },
    currentModuleIndex: { type: Number, min: 0, default: 0 },
    completedModuleIds: [{ type: Schema.Types.ObjectId, required: true }],
    startedAt: Date,
    lastAccessedAt: Date,
    completedAt: Date,
    bestScore: { type: Number, min: 0, max: 100 },
    passed: { type: Boolean, default: false },
  },
  { timestamps: true, versionKey: false },
);

courseProgressSchema.index({ userId: 1, courseId: 1 }, { unique: true });

export const CourseProgress: Model<ICourseProgress> = model<ICourseProgress>('CourseProgress', courseProgressSchema);
