import { model, Schema, type HydratedDocument, type Model, type Types } from 'mongoose';

export interface IAttemptAnswer {
  questionId: Types.ObjectId;
  selectedOptionIndex: number;
  pointsAwarded: number;
}

export interface IAssessmentAttempt {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  courseId: Types.ObjectId;
  answers: IAttemptAnswer[];
  score: number;
  maximumScore: number;
  percentage: number;
  passed: boolean;
  startedAt: Date;
  submittedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type AssessmentAttemptDocument = HydratedDocument<IAssessmentAttempt>;

const attemptAnswerSchema = new Schema<IAttemptAnswer>(
  {
    questionId: { type: Schema.Types.ObjectId, required: true },
    selectedOptionIndex: { type: Number, min: -1, required: true },
    pointsAwarded: { type: Number, min: 0, required: true },
  },
  { _id: false, versionKey: false },
);

const assessmentAttemptSchema = new Schema<IAssessmentAttempt>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    answers: { type: [attemptAnswerSchema], required: true },
    score: { type: Number, required: true, min: 0 },
    maximumScore: { type: Number, required: true, min: 0 },
    percentage: { type: Number, required: true, min: 0, max: 100 },
    passed: { type: Boolean, required: true },
    startedAt: { type: Date, required: true },
    submittedAt: { type: Date, required: true },
  },
  { timestamps: true, versionKey: false },
);

assessmentAttemptSchema.index({ userId: 1, courseId: 1, submittedAt: -1 });

export const AssessmentAttempt: Model<IAssessmentAttempt> = model<IAssessmentAttempt>(
  'AssessmentAttempt',
  assessmentAttemptSchema,
);
