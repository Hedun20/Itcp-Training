import { model, Schema, type HydratedDocument, type Model, type Types } from 'mongoose';

export const COURSE_STATUSES = ['draft', 'published', 'archived'] as const;
export const BLOCK_TYPES = ['heading', 'paragraph', 'image', 'callout', 'checklist'] as const;

export interface IContentBlock {
  _id: Types.ObjectId;
  type: (typeof BLOCK_TYPES)[number];
  text?: string;
  title?: string;
  level?: 2 | 3 | 4;
  url?: string;
  altText?: string;
  caption?: string;
  credit?: string;
  layout?: 'inline' | 'medium' | 'wide' | 'full';
  tone?: 'info' | 'tip' | 'success' | 'warning';
  items?: string[];
}

export interface ICourseModule {
  _id: Types.ObjectId;
  title: string;
  description?: string;
  order: number;
  blocks: IContentBlock[];
}

export interface IAssessmentQuestion {
  _id: Types.ObjectId;
  questionText: string;
  options: string[];
  correctAnswer: number;
  explanation?: string;
  points: number;
  order: number;
}

export interface ICourse {
  _id: Types.ObjectId;
  code: string;
  slug: string;
  title: string;
  shortDescription: string;
  description: string;
  coverImage?: string;
  estimatedDuration: string;
  passMark: number;
  status: (typeof COURSE_STATUSES)[number];
  category: string;
  tags: string[];
  modules: ICourseModule[];
  assessment: { questions: IAssessmentQuestion[] };
  createdBy: Types.ObjectId;
  updatedBy: Types.ObjectId;
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type CourseDocument = HydratedDocument<ICourse>;

const blockSchema = new Schema<IContentBlock>(
  {
    type: { type: String, enum: BLOCK_TYPES, required: true },
    text: { type: String, trim: true, maxlength: 20_000 },
    title: { type: String, trim: true, maxlength: 200 },
    level: { type: Number, enum: [2, 3, 4] },
    url: { type: String, trim: true, maxlength: 2_000 },
    altText: { type: String, trim: true, maxlength: 500 },
    caption: { type: String, trim: true, maxlength: 1_000 },
    credit: { type: String, trim: true, maxlength: 500 },
    layout: { type: String, enum: ['inline', 'medium', 'wide', 'full'], default: 'inline' },
    tone: { type: String, enum: ['info', 'tip', 'success', 'warning'], default: 'info' },
    items: [{ type: String, trim: true, maxlength: 2_000 }],
  },
  { versionKey: false },
);

const moduleSchema = new Schema<ICourseModule>(
  {
    title: { type: String, default: '', trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 1_000 },
    order: { type: Number, required: true, min: 0 },
    blocks: { type: [blockSchema], default: [] },
  },
  { versionKey: false },
);

const questionSchema = new Schema<IAssessmentQuestion>(
  {
    questionText: { type: String, default: '', trim: true, maxlength: 5_000 },
    options: {
      type: [{ type: String, trim: true, maxlength: 2_000 }],
      default: [],
    },
    correctAnswer: { type: Number, default: 0, min: 0, select: false },
    explanation: { type: String, trim: true, maxlength: 5_000 },
    points: { type: Number, min: 1, max: 100, default: 1 },
    order: { type: Number, min: 0, required: true },
  },
  { versionKey: false },
);

const courseSchema = new Schema<ICourse>(
  {
    code: { type: String, required: true, trim: true, uppercase: true, unique: true, index: true, maxlength: 30 },
    slug: { type: String, required: true, trim: true, lowercase: true, unique: true, index: true, maxlength: 160 },
    title: { type: String, required: true, trim: true, maxlength: 240 },
    shortDescription: { type: String, required: true, trim: true, maxlength: 600 },
    description: { type: String, default: '', trim: true, maxlength: 10_000 },
    coverImage: { type: String, trim: true, maxlength: 2_000 },
    estimatedDuration: { type: String, default: '', trim: true, maxlength: 80 },
    passMark: { type: Number, required: true, min: 0, max: 100 },
    status: { type: String, enum: COURSE_STATUSES, default: 'draft', index: true, required: true },
    category: { type: String, default: '', trim: true, maxlength: 120 },
    tags: [{ type: String, trim: true, lowercase: true, maxlength: 80 }],
    modules: { type: [moduleSchema], default: [] },
    assessment: {
      questions: { type: [questionSchema], default: [] },
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    publishedAt: { type: Date },
  },
  { timestamps: true, versionKey: false },
);

courseSchema.index({ status: 1, publishedAt: -1 });
courseSchema.index({ title: 'text', shortDescription: 'text', code: 'text', tags: 'text' });

export const Course: Model<ICourse> = model<ICourse>('Course', courseSchema);
