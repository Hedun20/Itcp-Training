import { describe, expect, it } from 'vitest';
import { emptyCourse, prepareCoursePayload, validateCourseForm } from '../utils/courseEditor';

describe('admin course form validation', () => {
  it('allows unfinished modules, blocks, and questions to be saved as a draft', () => {
    const errors = validateCourseForm({
      ...emptyCourse,
      code: 'DCT-05',
      slug: 'unfinished-course',
      title: 'Unfinished course',
      shortDescription: 'Draft',
      modules: [{ title: '', description: '', blocks: [{ type: 'paragraph', text: '' }] }],
      assessment: { questions: [{ question: '', options: ['', ''], correctAnswer: 8, points: 1 }] },
    });
    expect(errors).toEqual({});
  });

  it('requires publish-ready metadata, modules, valid options, and a bounded pass mark', () => {
    const course = {
      ...emptyCourse,
      code: 'DCT-05',
      slug: 'Invalid Slug',
      title: 'Draft course',
      shortDescription: 'A draft',
      passMark: 120,
      modules: [],
      assessment: { questions: [{ question: 'A question', options: ['Only one answer', ''], correctAnswer: 3 }] },
    };
    const errors = validateCourseForm(course, { publishing: true });
    expect(errors.slug).toMatch(/lowercase/i);
    expect(errors.passMark).toMatch(/between 0 and 100/i);
    expect(errors.modules).toMatch(/at least one module/i);
    expect(errors['question-0']).toMatch(/valid correct answer|at least two/i);
    expect(errors.description).toBeTruthy();
    expect(errors.estimatedDuration).toBeTruthy();
  });

  it('accepts a valid publishable course', () => {
    const errors = validateCourseForm({ ...emptyCourse, code: 'DCT-05', slug: 'digital-practice', title: 'Digital practice', shortDescription: 'Practice safely.', description: 'A complete description.', estimatedDuration: '30 minutes', category: 'Digital', passMark: 70, modules: [{ title: 'Module one', blocks: [] }], assessment: { questions: [{ question: 'Choose one', options: ['First', 'Second'], correctAnswer: 0, points: 1 }] } }, { publishing: true });
    expect(errors).toEqual({});
  });

  it('whitelists editable fields and maps question text to the write contract', () => {
    const payload = prepareCoursePayload({ ...emptyCourse, id: 'derived-id', status: 'published', summary: 'derived summary', createdAt: 'yesterday', code: 'DCT-05', slug: 'digital-practice', title: 'Digital practice', shortDescription: 'Practice safely.', description: 'A complete description.', estimatedDuration: '30 minutes', category: 'Digital', modules: [{ title: 'Module one', description: '', blocks: [] }], assessment: { questions: [{ question: 'Choose one', options: ['First', 'Second'], correctAnswer: 0, points: 1 }] } });
    expect(payload).not.toHaveProperty('status');
    expect(payload).not.toHaveProperty('id');
    expect(payload).not.toHaveProperty('summary');
    expect(payload).not.toHaveProperty('createdAt');
    expect(payload.assessment.questions[0]).toMatchObject({ questionText: 'Choose one', correctAnswer: 0 });
    expect(payload.assessment.questions[0]).not.toHaveProperty('question');
  });

  it('rejects publishing without an assessment question', () => {
    const errors = validateCourseForm({ ...emptyCourse, code: 'DCT-05', slug: 'digital-practice', title: 'Digital practice', shortDescription: 'Practice safely.', description: 'A complete description.', estimatedDuration: '30 minutes', category: 'Digital', modules: [{ title: 'Module one', blocks: [] }] }, { publishing: true });
    expect(errors.assessment).toMatch(/at least one assessment question/i);
  });

  it.each(['', 0, 1.5, 101])('always rejects invalid question points (%s)', (points) => {
    const errors = validateCourseForm({
      ...emptyCourse,
      code: 'DCT-05',
      slug: 'digital-practice',
      title: 'Digital practice',
      shortDescription: 'Practice safely.',
      assessment: { questions: [{ question: '', options: ['', ''], correctAnswer: 0, points }] },
    });
    expect(errors['question-0-points']).toMatch(/whole number between 1 and 100/i);
  });

  it('does not coerce an invalid points value while preparing the payload', () => {
    const payload = prepareCoursePayload({
      ...emptyCourse,
      assessment: { questions: [{ question: '', options: ['', ''], correctAnswer: 0, points: 0 }] },
    });
    expect(payload.assessment.questions[0].points).toBe(0);
  });

  it('preserves the explicit training-placeholder marker on seeded image blocks', () => {
    const payload = prepareCoursePayload({
      ...emptyCourse,
      modules: [{ title: 'Visual module', blocks: [{ type: 'image', url: '/training-placeholder.svg', altText: 'Neutral training visual', placeholder: true }] }],
    });
    expect(payload.modules[0].blocks[0]).toMatchObject({ type: 'image', placeholder: true });
  });
});
