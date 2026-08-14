import { describe, expect, it } from 'vitest';
import {
  COURSE_IMPORT_TEMPLATE,
  CourseImportError,
  parseCourseImportText,
  serializeCourseImportTemplate,
} from './courseImport';

describe('course JSON importer', () => {
  it('imports the complete official template', () => {
    const result = parseCourseImportText(JSON.stringify(COURSE_IMPORT_TEMPLATE));

    expect(result.course.title).toBe('Data Center Safety Fundamentals');
    expect(result.course.slug).toBe('data-center-safety-fundamentals');
    expect(result.course.status).toBe('draft');
    expect(result.course.modules).toHaveLength(2);
    expect(result.course.modules[0].blocks).toHaveLength(4);
    expect(result.course.assessment.questions).toHaveLength(2);
    expect(result.report.stats).toEqual({ modules: 2, blocks: 7, questions: 2 });
  });

  it('repairs common AI formatting errors without evaluating code', () => {
    const input = `Here is the course:\n\n\`\`\`json
    {
      schemaVersion: '1.0',
      course: {
        title: 'Rack Safety',
        description: 'Safe rack work',
        passMark: '80',
        tags: ['Safety',],
        modules: [
          {
            title: 'Preparation',
            blocks: [
              // AI comment
              { type: 'paragraph', text: 'Check authorization first.', },
            ],
          },
        ],
        assessment: {
          questions: [
            {
              question: 'What comes first?',
              answers: [
                { text: 'Check authorization', isCorrect: True },
                { text: 'Open the rack', isCorrect: False },
              ],
            },
          ],
        },
      },
    }
    \`\`\`\nDone.`;

    const result = parseCourseImportText(input);

    expect(result.course.slug).toBe('rack-safety');
    expect(result.course.code).toBe('RACK-SAFETY');
    expect(result.course.passMark).toBe(80);
    expect(result.course.assessment.questions[0].correctAnswer).toBe(0);
    expect(result.report.autoFixed.length).toBeGreaterThan(0);
  });

  it('converts lesson-shaped AI output into supported module blocks', () => {
    const result = parseCourseImportText(JSON.stringify({
      course: {
        title: 'Fiber Handling',
        summary: 'Safe fiber handling.',
        sections: [
          {
            name: 'Inspection',
            lessons: [
              { title: 'Before work', body: 'Inspect connectors and tools.' },
              { title: 'During work', content: [{ type: 'note', title: 'Tip', text: 'Keep caps installed.' }] },
            ],
          },
        ],
        finalQuiz: {
          questions: [
            {
              prompt: 'What protects an unused connector?',
              choices: ['A dust cap', 'A cable tie'],
              correctAnswer: 'A dust cap',
            },
          ],
        },
      },
    }));

    expect(result.course.modules[0].title).toBe('Inspection');
    expect(result.course.modules[0].blocks.map((block) => block.type)).toEqual([
      'heading', 'paragraph', 'heading', 'callout',
    ]);
    expect(result.course.assessment.questions[0].correctAnswer).toBe(0);
  });

  it('preserves an explicit valid slug and normalizes an invalid one', () => {
    const valid = parseCourseImportText(JSON.stringify({ course: { title: 'Safety', slug: 'custom-safety-url' } }));
    expect(valid.course.slug).toBe('custom-safety-url');
    expect(valid.report.slugGenerated).toBe(false);

    const invalid = parseCourseImportText(JSON.stringify({ course: { title: 'Safety', slug: 'Safety URL!!!' } }));
    expect(invalid.course.slug).toBe('safety-url');
    expect(invalid.report.autoFixed.some((issue) => issue.path === 'course.slug')).toBe(true);
  });

  it('adds review issues instead of crashing on incomplete questions', () => {
    const result = parseCourseImportText(JSON.stringify({
      course: {
        title: 'Incomplete Course',
        modules: [{ title: 'Module', content: 'Body' }],
        questions: [{ question: 'Question without answers' }],
      },
    }));

    expect(result.course.assessment.questions[0].options).toHaveLength(2);
    expect(result.report.reviewRequired.some((issue) => issue.path.includes('options'))).toBe(true);
  });


  it('converts true/false questions and flags unsupported multiple-answer questions', () => {
    const result = parseCourseImportText(JSON.stringify({
      course: {
        title: 'Boolean safety checks',
        modules: [{ title: 'Rules', content: 'Follow the rules.' }],
        assessment: {
          questions: [
            { type: 'true_false', question: 'Credentials may be shared.', correctAnswer: false },
            {
              type: 'multiple_choice',
              question: 'Select safe actions.',
              options: [
                { text: 'Check authorization', isCorrect: true },
                { text: 'Wear required PPE', isCorrect: true },
                { text: 'Ignore alarms', isCorrect: false },
              ],
            },
          ],
        },
      },
    }));

    expect(result.course.assessment.questions[0]).toMatchObject({
      options: ['True', 'False'],
      correctAnswer: 1,
    });
    expect(result.report.reviewRequired.some((issue) => issue.path.endsWith('.type'))).toBe(true);
    expect(result.report.reviewRequired.some((issue) => issue.message.includes('Multiple correct answers'))).toBe(true);
  });

  it('repairs apostrophes inside single-quoted AI strings', () => {
    const result = parseCourseImportText("{course:{title:'It\\'s safe',modules:[{title:'Workers\\' safety',content:'It\\'s important'}]}}");
    expect(result.course.title).toBe("It's safe");
    expect(result.course.modules[0].title).toBe("Workers' safety");
  });

  it('rejects text without a JSON object', () => {
    expect(() => parseCourseImportText('There is no object here.')).toThrow(CourseImportError);
  });

  it('serializes a valid downloadable template', () => {
    expect(JSON.parse(serializeCourseImportTemplate())).toEqual(COURSE_IMPORT_TEMPLATE);
  });
});
