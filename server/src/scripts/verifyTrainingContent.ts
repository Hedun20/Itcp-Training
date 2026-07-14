import { connectDatabase, disconnectDatabase } from '../config/database';
import { getEnv } from '../config/env';
import {
  authoritativeTrainingProjection,
  compareStructuredTrainingContent,
  trainingProjectionTotals,
  type StructuredTrainingLike,
} from '../data/trainingContentParity';
import { Course } from '../models/Course';

const ORIGINAL_COURSE_CODES = ['DCT-01', 'DCT-02', 'HSE-01', 'ACS-01'] as const;

async function main() {
  const env = getEnv();
  if (env.NODE_ENV === 'production') {
    throw new Error('Training content verification is development/test-only and cannot run in production');
  }

  await connectDatabase();
  try {
    const stored = await Course.find({ code: { $in: ORIGINAL_COURSE_CODES } })
      .select('+assessment.questions.correctAnswer')
      .lean();
    const ordered = ORIGINAL_COURSE_CODES.flatMap((code) => {
      const course = stored.find((candidate) => candidate.code === code);
      return course ? [course] : [];
    });
    const contentBlocks = ordered.reduce(
      (total, course) => total + course.modules.reduce((moduleTotal, module) => moduleTotal + module.blocks.length, 0),
      0,
    );
    const databaseTotals = {
      courses: ordered.length,
      modules: ordered.reduce((total, course) => total + course.modules.length, 0),
      paragraphs: ordered.reduce(
        (total, course) =>
          total +
          course.modules.reduce(
            (moduleTotal, module) =>
              moduleTotal + module.blocks.filter((block) => block.type === 'paragraph').length,
            0,
          ),
        0,
      ),
      contentBlocks,
      questions: ordered.reduce((total, course) => total + course.assessment.questions.length, 0),
      answerOptions: ordered.reduce(
        (total, course) =>
          total + course.assessment.questions.reduce((quizTotal, question) => quizTotal + question.options.length, 0),
        0,
      ),
    };
    const report = {
      environment: env.NODE_ENV,
      expectedCourseCodes: ORIGINAL_COURSE_CODES,
      missingCourseCodes: ORIGINAL_COURSE_CODES.filter((code) => !stored.some((course) => course.code === code)),
      sourceTotals: trainingProjectionTotals(authoritativeTrainingProjection()),
      databaseTotals,
      coursesMissingImages: ordered
        .filter(
          (course) =>
            !course.modules.some((module) =>
              module.blocks.some((block) => block.type === 'image' && Boolean(block.url)),
            ),
        )
        .map((course) => course.code),
      coursesMissingPublishedStatus: ordered
        .filter((course) => course.status !== 'published' || !course.publishedAt)
        .map((course) => course.code),
      exactSourceParity: compareStructuredTrainingContent(ordered as unknown as StructuredTrainingLike[]),
    };
    console.log(JSON.stringify(report, null, 2));
    if (
      report.missingCourseCodes.length ||
      report.coursesMissingImages.length ||
      report.coursesMissingPublishedStatus.length ||
      !report.exactSourceParity.sourceMatchesAuthoritativeManifest ||
      !report.exactSourceParity.exactMatch
    ) {
      process.exitCode = 1;
    }
  } finally {
    await disconnectDatabase();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Training content verification failed', error);
    process.exitCode = 1;
  });
}
