export const blockTypes = [
  { value: 'heading', label: 'Heading' },
  { value: 'paragraph', label: 'Paragraph' },
  { value: 'callout', label: 'Callout' },
  { value: 'checklist', label: 'Checklist' },
  { value: 'image', label: 'Image' },
];

export const emptyCourse = {
  code: '',
  slug: '',
  title: '',
  shortDescription: '',
  description: '',
  coverImage: '',
  estimatedDuration: '',
  passMark: 70,
  category: '',
  tags: [],
  status: 'draft',
  modules: [],
  assessment: { questions: [] },
};

export function createClientId(prefix = 'item') {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
}

export function createModule() {
  return { _clientId: createClientId('module'), title: 'New module', description: '', blocks: [] };
}

export function createBlock(type = 'paragraph') {
  const base = { _clientId: createClientId('block'), type };
  if (type === 'heading') return { ...base, text: 'New section', level: 2 };
  if (type === 'callout') return { ...base, title: '', text: '', tone: 'info' };
  if (type === 'checklist') return { ...base, items: [''] };
  if (type === 'image') return { ...base, url: '', altText: '', caption: '', credit: '', layout: 'wide' };
  return { ...base, text: '' };
}

export function createQuestion() {
  return {
    _clientId: createClientId('question'),
    question: '',
    options: ['', ''],
    correctAnswer: 0,
    explanation: '',
    points: 1,
  };
}

export function moveItem(items, from, to) {
  if (to < 0 || to >= items.length || from === to) return items;
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function validateCourseForm(course, { publishing = false } = {}) {
  const errors = {};
  const code = course.code?.trim() || '';
  const slug = course.slug?.trim() || '';
  const title = course.title?.trim() || '';
  const shortDescription = course.shortDescription?.trim() || '';

  if (!code) errors.code = 'Course code is required.';
  else if (code.length < 2 || code.length > 30) errors.code = 'Course code must be between 2 and 30 characters.';
  else if (!/^[A-Za-z0-9-]+$/.test(code)) errors.code = 'Use letters, numbers, and hyphens only.';
  if (!slug) errors.slug = 'URL slug is required.';
  else if (slug.length < 2 || slug.length > 160) errors.slug = 'URL slug must be between 2 and 160 characters.';
  else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) errors.slug = 'Use lowercase letters, numbers, and hyphens only.';
  if (!title) errors.title = 'Course title is required.';
  else if (title.length < 2 || title.length > 240) errors.title = 'Course title must be between 2 and 240 characters.';
  if (!shortDescription) errors.shortDescription = 'Short description is required.';
  else if (shortDescription.length > 600) errors.shortDescription = 'Short description must be 600 characters or fewer.';

  if ((course.description || '').trim().length > 10_000) errors.description = 'Full description must be 10,000 characters or fewer.';
  if ((course.estimatedDuration || '').trim().length > 80) errors.estimatedDuration = 'Estimated duration must be 80 characters or fewer.';
  if ((course.category || '').trim().length > 120) errors.category = 'Category must be 120 characters or fewer.';
  if ((course.coverImage || '').trim().length > 2_000) errors.coverImage = 'Cover image URL must be 2,000 characters or fewer.';
  const tags = Array.isArray(course.tags) ? course.tags : [];
  if (tags.length > 30) errors.tags = 'Use no more than 30 tags.';
  else if (tags.some((tag) => String(tag).trim().length > 80)) errors.tags = 'Each tag must be 80 characters or fewer.';

  const passMark = Number(course.passMark);
  if (String(course.passMark ?? '').trim() === '' || !Number.isFinite(passMark) || passMark < 0 || passMark > 100) errors.passMark = 'Pass mark must be between 0 and 100.';

  const modules = Array.isArray(course.modules) ? course.modules : [];
  if (modules.length > 100) errors.modules = 'A course can contain at most 100 modules.';
  modules.forEach((module, moduleIndex) => {
    const moduleKey = `module-${moduleIndex}`;
    const moduleTitle = (module.title || module.name || '').trim();
    if (moduleTitle.length > 200) errors[moduleKey] = `Module ${moduleIndex + 1} title must be 200 characters or fewer.`;
    else if ((module.description || '').trim().length > 1_000) errors[moduleKey] = `Module ${moduleIndex + 1} summary must be 1,000 characters or fewer.`;
    else if ((module.blocks || []).length > 300) errors[moduleKey] = `Module ${moduleIndex + 1} can contain at most 300 blocks.`;
    else if (publishing && !moduleTitle) errors[moduleKey] = `Module ${moduleIndex + 1} needs a title.`;
    (module.blocks || []).forEach((block, blockIndex) => {
      const key = `block-${moduleIndex}-${blockIndex}`;
      const blockText = (block.text || '').trim();
      if (['heading', 'paragraph', 'callout'].includes(block.type) && blockText.length > 20_000) errors[key] = `Block ${blockIndex + 1} text must be 20,000 characters or fewer.`;
      else if (block.type === 'callout' && (block.title || '').trim().length > 200) errors[key] = `Callout ${blockIndex + 1} title must be 200 characters or fewer.`;
      else if (block.type === 'checklist' && (block.items || []).length > 100) errors[key] = `Checklist ${blockIndex + 1} can contain at most 100 items.`;
      else if (block.type === 'checklist' && (block.items || []).some((item) => String(typeof item === 'string' ? item : item?.text || '').trim().length > 2_000)) errors[key] = `Checklist ${blockIndex + 1} items must be 2,000 characters or fewer.`;
      else if (block.type === 'image' && (block.url || '').trim().length > 2_000) errors[key] = `Image ${blockIndex + 1} URL must be 2,000 characters or fewer.`;
      else if (block.type === 'image' && (block.altText || '').trim().length > 500) errors[key] = `Image ${blockIndex + 1} alternative text must be 500 characters or fewer.`;
      else if (block.type === 'image' && (block.caption || '').trim().length > 1_000) errors[key] = `Image ${blockIndex + 1} caption must be 1,000 characters or fewer.`;
      else if (block.type === 'image' && (block.credit || '').trim().length > 500) errors[key] = `Image ${blockIndex + 1} credit must be 500 characters or fewer.`;
      else if (publishing && ['heading', 'paragraph', 'callout'].includes(block.type) && !blockText) errors[key] = `Block ${blockIndex + 1} in module ${moduleIndex + 1} needs text.`;
      else if (publishing && block.type === 'checklist' && (!block.items?.length || block.items.some((item) => !String(typeof item === 'string' ? item : item?.text || '').trim()))) errors[key] = `Checklist ${blockIndex + 1} in module ${moduleIndex + 1} contains an empty item.`;
      else if (publishing && block.type === 'image' && (!block.url?.trim() || !block.altText?.trim())) errors[key] = `Image ${blockIndex + 1} in module ${moduleIndex + 1} needs a URL and alternative text.`;
    });
  });

  const questions = course.assessment?.questions || [];
  if (questions.length > 200) errors.assessment = 'An assessment can contain at most 200 questions.';
  questions.forEach((question, index) => {
    const key = `question-${index}`;
    const questionText = (question.question || question.questionText || '').trim();
    const options = Array.isArray(question.options) ? question.options : [];
    const optionText = options.map((option) => String(typeof option === 'string' ? option : option?.text || '').trim());
    if (questionText.length > 5_000) errors[key] = `Question ${index + 1} text must be 5,000 characters or fewer.`;
    else if (options.length > 12) errors[key] = `Question ${index + 1} can contain at most 12 answer options.`;
    else if (optionText.some((option) => option.length > 2_000)) errors[key] = `Question ${index + 1} options must be 2,000 characters or fewer.`;
    else if ((question.explanation || '').trim().length > 5_000) errors[key] = `Question ${index + 1} explanation must be 5,000 characters or fewer.`;

    const points = Number(question.points);
    if (String(question.points ?? '').trim() === '' || !Number.isInteger(points) || points < 1 || points > 100) {
      errors[`question-${index}-points`] = `Question ${index + 1} points must be a whole number between 1 and 100.`;
    }

    if (!publishing) return;
    if (!questionText) errors[key] = `Question ${index + 1} needs question text.`;
    const meaningfulOptions = question.options?.filter((option) => (typeof option === 'string' ? option : option?.text)?.trim()) || [];
    if (meaningfulOptions.length < 2 || meaningfulOptions.length !== question.options?.length) errors[key] = `Question ${index + 1} needs at least two complete answer options.`;
    if (!Number.isInteger(Number(question.correctAnswer)) || Number(question.correctAnswer) < 0 || Number(question.correctAnswer) >= (question.options?.length || 0)) errors[key] = `Question ${index + 1} needs one valid correct answer.`;
  });

  if (publishing) {
    if (!course.description?.trim()) errors.description = 'Full description is required before publishing.';
    if (!course.estimatedDuration?.trim()) errors.estimatedDuration = 'Estimated duration is required before publishing.';
    if (!course.category?.trim()) errors.category = 'Category is required before publishing.';
    if (!modules.length) errors.modules = 'Add at least one module before publishing.';
    if (!questions.length) errors.assessment = 'Add at least one assessment question before publishing.';
  }
  return errors;
}

function optionalId(value) {
  const id = value?._id || value?.id;
  return /^[a-f\d]{24}$/i.test(id || '') ? { _id: id } : {};
}

function prepareBlock(block) {
  const base = { ...optionalId(block), type: block.type };
  if (block.type === 'heading') return { ...base, text: block.text, level: Number(block.level) || 2 };
  if (block.type === 'paragraph') return { ...base, text: block.text };
  if (block.type === 'callout') return { ...base, title: block.title || '', text: block.text, tone: block.tone || 'info' };
  if (block.type === 'checklist') return { ...base, items: (block.items || []).map((item) => typeof item === 'string' ? item : item.text) };
  if (block.type === 'image') return { ...base, url: block.url, altText: block.altText, caption: block.caption || '', credit: block.credit || '', layout: block.layout || 'wide' };
  return base;
}

export function prepareCoursePayload(course) {
  return {
    code: course.code,
    slug: course.slug,
    title: course.title,
    shortDescription: course.shortDescription,
    description: course.description,
    coverImage: course.coverImage || '',
    estimatedDuration: course.estimatedDuration,
    passMark: Number(course.passMark),
    category: course.category,
    tags: Array.isArray(course.tags) ? course.tags.filter(Boolean) : [],
    modules: (course.modules || []).map((module, moduleIndex) => ({ ...optionalId(module), title: module.title, description: module.description || '', order: moduleIndex, blocks: (module.blocks || []).map(prepareBlock) })),
    assessment: {
      questions: (course.assessment?.questions || []).map((question, index) => ({
        ...optionalId(question),
        questionText: question.questionText || question.question,
        options: (question.options || []).map((option) => typeof option === 'string' ? option : option.text),
        correctAnswer: Number(question.correctAnswer),
        explanation: question.explanation || '',
        points: Number(question.points),
        order: index,
      })),
    },
  };
}

export function normalizeCourseForEditor(course) {
  return {
    ...emptyCourse,
    ...course,
    coverImage: course.coverImage?.url || course.coverImage || '',
    tags: course.tags || [],
    modules: (course.modules || []).map((module) => ({ ...module, _clientId: createClientId('module'), blocks: (module.blocks || module.contentBlocks || []).map((block) => ({ ...block, _clientId: createClientId('block') })) })),
    assessment: { ...(course.assessment || {}), questions: (course.assessment?.questions || course.questions || []).map((question) => ({ ...question, question: question.question ?? question.questionText ?? question.text ?? '', _clientId: createClientId('question'), correctAnswer: question.correctAnswer ?? question.correctOptionIndex ?? 0 })) },
  };
}
