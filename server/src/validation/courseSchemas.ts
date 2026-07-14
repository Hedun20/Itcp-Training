import { z } from 'zod';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid identifier');
const optionalId = z.object({ _id: objectId.optional(), id: objectId.optional() }).partial();
const safeImageUrl = z
  .string()
  .trim()
  .max(2_000)
  .refine(
    (value) =>
      value.startsWith('/uploads/') ||
      /^https?:\/\//i.test(value) ||
      /^\/(?!.*\.\.)[a-z0-9/_-]+\.(?:png|jpe?g|webp|gif|svg)$/i.test(value),
    'Use an HTTP(S) URL, local upload URL, or safe root-local image asset',
  );

const headingBlock = optionalId.extend({
  type: z.literal('heading'),
  text: z.string().trim().max(20_000),
  level: z.union([z.literal(2), z.literal(3), z.literal(4)]).default(2),
});
const paragraphBlock = optionalId.extend({
  type: z.literal('paragraph'),
  text: z.string().trim().max(20_000),
});
const imageBlock = optionalId.extend({
  type: z.literal('image'),
  url: safeImageUrl.or(z.literal('')),
  altText: z.string().trim().max(500),
  caption: z.string().trim().max(1_000).optional(),
  credit: z.string().trim().max(500).optional(),
  placeholder: z.boolean().default(false),
  layout: z.enum(['inline', 'medium', 'wide', 'full']).default('inline'),
});
const calloutBlock = optionalId.extend({
  type: z.literal('callout'),
  title: z.string().trim().max(200).optional(),
  text: z.string().trim().max(20_000),
  tone: z.enum(['info', 'tip', 'success', 'warning']).default('info'),
});
const checklistBlock = optionalId.extend({
  type: z.literal('checklist'),
  items: z.array(z.string().trim().max(2_000)).max(100),
});

export const contentBlockSchema = z.discriminatedUnion('type', [
  headingBlock,
  paragraphBlock,
  imageBlock,
  calloutBlock,
  checklistBlock,
]);

export const courseModuleSchema = optionalId.extend({
  title: z.string().trim().max(200),
  description: z.string().trim().max(1_000).optional(),
  order: z.number().int().min(0),
  blocks: z.array(contentBlockSchema).max(300),
});

const questionTextSchema = z.string().trim().max(5_000);

export const assessmentQuestionSchema = optionalId
  .extend({
    questionText: questionTextSchema.optional(),
    question: questionTextSchema.optional(),
    options: z.array(z.string().trim().max(2_000)).max(12),
    correctAnswer: z.number().int().min(0),
    explanation: z.string().trim().max(5_000).optional(),
    points: z.number().int().min(1).max(100).default(1),
    order: z.number().int().min(0),
  })
  .transform(({ question, ...value }) => ({ ...value, questionText: value.questionText ?? question ?? '' }));

const courseFields = {
  code: z.string().trim().min(2).max(30).regex(/^[A-Za-z0-9-]+$/).transform((value) => value.toUpperCase()),
  slug: z.string().trim().min(2).max(160).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title: z.string().trim().min(2).max(240),
  shortDescription: z.string().trim().min(1).max(600),
  description: z.string().trim().max(10_000).default(''),
  coverImage: safeImageUrl.optional().or(z.literal('')).transform((value) => value || undefined),
  estimatedDuration: z.string().trim().max(80).default(''),
  passMark: z.number().min(0).max(100),
  category: z.string().trim().max(120).default(''),
  tags: z.array(z.string().trim().min(1).max(80)).max(30).default([]),
  modules: z.array(courseModuleSchema).max(100).default([]),
  assessment: z.object({ questions: z.array(assessmentQuestionSchema).max(200).default([]) }).default({ questions: [] }),
};

export const createCourseSchema = z.object(courseFields);
export const updateCourseSchema = z.object(courseFields).partial().refine((body) => Object.keys(body).length > 0, {
  message: 'At least one field must be supplied',
});

export const courseListQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export const identifierParamsSchema = z.object({ id: z.string().trim().min(1).max(200) });
