import { createCourseSlug, normalizeCourseSlug } from './courseSlug';
import {
  COURSE_IMPORT_SCHEMA_VERSION,
  COURSE_IMPORT_TEMPLATE,
  MAX_COURSE_IMPORT_BYTES,
} from './courseImportTemplate';
import {
  CourseImportError,
  addFixed,
  addReview,
  clampNumber,
  clipText,
  firstDefined,
  isPlainObject,
  parseJsonText,
  toText,
} from './courseImportCore';
import { normalizeModule, normalizeTags } from './courseImportContent';
import { normalizeQuestion } from './courseImportAssessment';

export { COURSE_IMPORT_SCHEMA_VERSION, COURSE_IMPORT_TEMPLATE, MAX_COURSE_IMPORT_BYTES, CourseImportError };

function createCourseCode(value) {
  return createCourseSlug(value, { maxLength: 30 }).toUpperCase();
}

function normalizeCourse(rawValue, parseRepairs) {
  const report = {
    schemaVersion: COURSE_IMPORT_SCHEMA_VERSION,
    sourceSchemaVersion: '',
    parserRepairs: parseRepairs,
    autoFixed: [],
    reviewRequired: [],
    stats: { modules: 0, blocks: 0, questions: 0 },
    slugGenerated: false,
  };

  const root = isPlainObject(rawValue) ? rawValue : {};
  report.sourceSchemaVersion = toText(firstDefined(root.schemaVersion, root.version));
  if (report.sourceSchemaVersion && report.sourceSchemaVersion !== COURSE_IMPORT_SCHEMA_VERSION) {
    addReview(report, 'schemaVersion', `Template version ${report.sourceSchemaVersion} is not officially supported. Review the imported course carefully.`);
  }
  for (const repair of parseRepairs) addFixed(report, 'json', repair);

  const source = isPlainObject(root.course) ? root.course : isPlainObject(root.data?.course) ? root.data.course : root;
  if (!isPlainObject(source)) throw new CourseImportError('The JSON does not contain a course object.', { code: 'COURSE_OBJECT_MISSING' });

  const title = clipText(firstDefined(source.title, source.name, source.courseTitle), 240, 'course.title', report);
  if (!title) addReview(report, 'course.title', 'Course title is missing.');

  const explicitSlug = toText(firstDefined(source.slug, source.urlSlug, source.courseSlug));
  const slug = normalizeCourseSlug(explicitSlug, title);
  if (!explicitSlug && slug) {
    report.slugGenerated = true;
    addFixed(report, 'course.slug', 'URL slug was generated from the course title.');
  } else if (explicitSlug && slug !== explicitSlug) {
    addFixed(report, 'course.slug', 'URL slug was normalized to a safe URL format.');
  }
  if (!slug) addReview(report, 'course.slug', 'URL slug could not be generated because the title is missing.');

  let code = clipText(firstDefined(source.code, source.courseCode), 30, 'course.code', report)
    .toUpperCase()
    .replace(/[^A-Z0-9-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  if (!code && title) {
    code = createCourseCode(title);
    addFixed(report, 'course.code', 'Course code was generated from the course title.');
  }
  if (!code) addReview(report, 'course.code', 'Course code is missing.');

  const description = clipText(firstDefined(source.description, source.fullDescription, source.overview), 10_000, 'course.description', report);
  let shortDescription = clipText(firstDefined(source.shortDescription, source.summary, source.excerpt), 600, 'course.shortDescription', report);
  if (!shortDescription && description) {
    shortDescription = description.slice(0, 600).trim();
    addFixed(report, 'course.shortDescription', 'Short description was generated from the full description.');
  }
  if (!shortDescription) addReview(report, 'course.shortDescription', 'Short description is missing.');

  const durationValue = firstDefined(source.estimatedDuration, source.duration, source.estimatedDurationMinutes);
  const estimatedDuration = typeof durationValue === 'number'
    ? `${durationValue} minutes`
    : clipText(durationValue, 80, 'course.estimatedDuration', report);

  let modulesSource = firstDefined(source.modules, source.sections, source.chapters);
  if (!Array.isArray(modulesSource)) modulesSource = modulesSource ? [modulesSource] : [];
  if (modulesSource.length > 100) {
    modulesSource = modulesSource.slice(0, 100);
    addFixed(report, 'course.modules', 'Only the first 100 modules were imported.');
  }
  const modules = modulesSource.map((module, index) => normalizeModule(module, index, report));
  if (!modules.length) addReview(report, 'course.modules', 'Add at least one module before publishing.');

  const assessmentSource = firstDefined(source.assessment, source.finalAssessment, source.finalTest, source.finalQuiz, source.quiz);
  let questionsSource = firstDefined(
    assessmentSource?.questions,
    source.questions,
    source.assessmentQuestions,
  );
  if (!Array.isArray(questionsSource)) questionsSource = questionsSource ? [questionsSource] : [];
  if (questionsSource.length > 200) {
    questionsSource = questionsSource.slice(0, 200);
    addFixed(report, 'course.assessment.questions', 'Only the first 200 questions were imported.');
  }
  const questions = questionsSource.map((question, index) => normalizeQuestion(question, index, report));
  if (!questions.length) addReview(report, 'course.assessment.questions', 'Add at least one assessment question before publishing.');

  report.stats = {
    modules: modules.length,
    blocks: modules.reduce((total, module) => total + module.blocks.length, 0),
    questions: questions.length,
  };

  const cover = firstDefined(source.coverImage, source.cover, source.image);
  const coverImage = clipText(isPlainObject(cover) ? firstDefined(cover.url, cover.src) : cover, 2_000, 'course.coverImage', report);

  return {
    course: {
      code,
      slug,
      title,
      shortDescription,
      description,
      coverImage,
      estimatedDuration,
      passMark: clampNumber(firstDefined(source.passMark, source.passingScore, source.passingScorePercent), { min: 0, max: 100, fallback: 70, integer: true }, 'course.passMark', report),
      category: clipText(firstDefined(source.category, source.topic), 120, 'course.category', report),
      tags: normalizeTags(firstDefined(source.tags, source.keywords), report),
      status: 'draft',
      modules,
      assessment: { questions },
    },
    report,
  };
}

export function parseCourseImportText(rawText) {
  if (typeof rawText !== 'string' || !rawText.trim()) {
    throw new CourseImportError('The selected JSON file is empty.', { code: 'EMPTY_FILE' });
  }
  const parsed = parseJsonText(rawText);
  return normalizeCourse(parsed.value, parsed.repairs);
}

export async function parseCourseImportFile(file) {
  const isBrowserFile = typeof File !== 'undefined' && file instanceof File;
  if (!isBrowserFile && !(file && typeof file.text === 'function')) {
    throw new CourseImportError('Select a valid JSON file.', { code: 'INVALID_FILE' });
  }
  if (Number(file.size) > MAX_COURSE_IMPORT_BYTES) {
    throw new CourseImportError('The JSON file is larger than 5 MB.', { code: 'FILE_TOO_LARGE' });
  }
  const fileName = toText(file.name).toLowerCase();
  if (fileName && !fileName.endsWith('.json')) {
    throw new CourseImportError('Only .json files can be imported.', { code: 'UNSUPPORTED_FILE_TYPE' });
  }
  return parseCourseImportText(await file.text());
}

export function serializeCourseImportTemplate() {
  return `${JSON.stringify(COURSE_IMPORT_TEMPLATE, null, 2)}\n`;
}
