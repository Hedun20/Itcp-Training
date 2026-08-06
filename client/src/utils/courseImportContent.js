import { createClientId } from './courseEditor';
import {
  addFixed,
  addReview,
  clampNumber,
  clipText,
  firstDefined,
  isPlainObject,
  toArray,
  toText,
} from './courseImportCore';

export function normalizeTags(value, report) {
  const values = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [];
  const unique = [];
  for (const item of values) {
    const tag = clipText(item, 80, 'course.tags', report).toLowerCase();
    if (tag && !unique.includes(tag)) unique.push(tag);
  }
  if (unique.length > 30) {
    addFixed(report, 'course.tags', 'Only the first 30 tags were imported.');
    return unique.slice(0, 30);
  }
  return unique;
}

function normalizeTone(value) {
  const tone = toText(value).toLowerCase();
  if (['info', 'tip', 'success', 'warning'].includes(tone)) return tone;
  if (['danger', 'error', 'caution', 'important'].includes(tone)) return 'warning';
  if (['note', 'information'].includes(tone)) return 'info';
  return 'info';
}

function normalizeLayout(value) {
  const layout = toText(value).toLowerCase();
  return ['inline', 'medium', 'wide', 'full'].includes(layout) ? layout : 'wide';
}

function normalizeBlock(rawBlock, path, report) {
  if (typeof rawBlock === 'string') {
    return { _clientId: createClientId('block'), type: 'paragraph', text: clipText(rawBlock, 20_000, `${path}.text`, report) };
  }
  if (!isPlainObject(rawBlock)) {
    addReview(report, path, 'Unsupported learning block was skipped.');
    return null;
  }

  const rawType = toText(firstDefined(rawBlock.type, rawBlock.kind, rawBlock.blockType)).toLowerCase();
  const aliases = {
    h1: 'heading', h2: 'heading', h3: 'heading', title: 'heading', subtitle: 'heading',
    text: 'paragraph', body: 'paragraph', content: 'paragraph',
    note: 'callout', warning: 'callout', tip: 'callout', alert: 'callout',
    list: 'checklist', bullets: 'checklist', bullet_list: 'checklist',
    picture: 'image', photo: 'image',
  };
  let type = aliases[rawType] || rawType;
  if (!type) type = rawBlock.items ? 'checklist' : rawBlock.url || rawBlock.imageUrl ? 'image' : rawBlock.title && rawBlock.text ? 'callout' : 'paragraph';
  if (!['heading', 'paragraph', 'callout', 'checklist', 'image'].includes(type)) {
    if (toText(firstDefined(rawBlock.text, rawBlock.body, rawBlock.content))) {
      addFixed(report, path, `Unknown block type "${rawType}" was imported as a paragraph.`);
      type = 'paragraph';
    } else {
      addReview(report, path, `Unknown block type "${rawType || 'empty'}" was skipped.`);
      return null;
    }
  }

  const base = { _clientId: createClientId('block'), type };
  if (type === 'heading') {
    const text = clipText(firstDefined(rawBlock.text, rawBlock.title, rawBlock.heading), 20_000, `${path}.text`, report);
    const level = clampNumber(firstDefined(rawBlock.level, rawType === 'h3' ? 3 : rawType === 'h1' ? 2 : 2), { min: 2, max: 4, fallback: 2, integer: true }, `${path}.level`, report);
    if (!text) addReview(report, `${path}.text`, 'Heading text is missing.');
    return { ...base, text, level };
  }
  if (type === 'paragraph') {
    const text = clipText(firstDefined(rawBlock.text, rawBlock.body, rawBlock.content, rawBlock.description), 20_000, `${path}.text`, report);
    if (!text) addReview(report, `${path}.text`, 'Paragraph text is missing.');
    return { ...base, text };
  }
  if (type === 'callout') {
    const text = clipText(firstDefined(rawBlock.text, rawBlock.body, rawBlock.content, rawBlock.message), 20_000, `${path}.text`, report);
    if (!text) addReview(report, `${path}.text`, 'Callout text is missing.');
    return {
      ...base,
      title: clipText(firstDefined(rawBlock.title, rawBlock.heading), 200, `${path}.title`, report),
      text,
      tone: normalizeTone(firstDefined(rawBlock.tone, rawBlock.severity, rawType)),
    };
  }
  if (type === 'checklist') {
    const rawItems = firstDefined(rawBlock.items, rawBlock.options, rawBlock.list, rawBlock.text);
    const items = (Array.isArray(rawItems) ? rawItems : toText(rawItems).split(/\r?\n/))
      .map((item) => clipText(isPlainObject(item) ? firstDefined(item.text, item.label, item.value) : item, 2_000, `${path}.items`, report))
      .filter(Boolean)
      .slice(0, 100);
    if (!items.length) addReview(report, `${path}.items`, 'Checklist has no items.');
    return { ...base, items };
  }

  const url = clipText(firstDefined(rawBlock.url, rawBlock.imageUrl, rawBlock.src), 2_000, `${path}.url`, report);
  const altText = clipText(firstDefined(rawBlock.altText, rawBlock.alt, rawBlock.description), 500, `${path}.altText`, report);
  if (!url) addReview(report, `${path}.url`, 'Image URL is missing. Choose an image from the media library.');
  if (!altText) addReview(report, `${path}.altText`, 'Image alternative text is missing.');
  return {
    ...base,
    url,
    altText,
    caption: clipText(rawBlock.caption, 1_000, `${path}.caption`, report),
    credit: clipText(rawBlock.credit, 500, `${path}.credit`, report),
    layout: normalizeLayout(rawBlock.layout),
    placeholder: false,
  };
}

function normalizeLessonBlocks(lesson, path, report) {
  if (typeof lesson === 'string') return [normalizeBlock(lesson, path, report)].filter(Boolean);
  if (!isPlainObject(lesson)) return [];

  const blocks = [];
  const lessonTitle = toText(firstDefined(lesson.title, lesson.name));
  if (lessonTitle) blocks.push(normalizeBlock({ type: 'heading', text: lessonTitle, level: 3 }, `${path}.title`, report));
  const source = firstDefined(lesson.blocks, lesson.contentBlocks, lesson.content, lesson.body, lesson.text);
  for (const [index, block] of toArray(source).entries()) {
    const normalized = normalizeBlock(block, `${path}.blocks[${index}]`, report);
    if (normalized) blocks.push(normalized);
  }
  return blocks.filter(Boolean);
}

export function normalizeModule(rawModule, index, report) {
  const path = `course.modules[${index}]`;
  const source = isPlainObject(rawModule) ? rawModule : { title: `Module ${index + 1}`, content: rawModule };
  const title = clipText(firstDefined(source.title, source.name, source.moduleTitle), 200, `${path}.title`, report);
  if (!title) addReview(report, `${path}.title`, `Module ${index + 1} needs a title.`);

  let blocks = [];
  const directBlocks = firstDefined(source.blocks, source.contentBlocks);
  if (directBlocks !== undefined) {
    blocks = toArray(directBlocks).map((block, blockIndex) => normalizeBlock(block, `${path}.blocks[${blockIndex}]`, report)).filter(Boolean);
  } else if (Array.isArray(source.lessons) || Array.isArray(source.chapters)) {
    const lessons = source.lessons || source.chapters;
    blocks = lessons.flatMap((lesson, lessonIndex) => normalizeLessonBlocks(lesson, `${path}.lessons[${lessonIndex}]`, report));
    addFixed(report, `${path}.lessons`, 'Lesson content was converted into supported learning blocks.');
  } else {
    const content = firstDefined(source.content, source.body, source.text);
    blocks = toArray(content).map((block, blockIndex) => normalizeBlock(block, `${path}.blocks[${blockIndex}]`, report)).filter(Boolean);
  }

  if (blocks.length > 300) {
    blocks = blocks.slice(0, 300);
    addFixed(report, `${path}.blocks`, 'Only the first 300 learning blocks were imported.');
  }
  if (!blocks.length) addReview(report, `${path}.blocks`, `Module ${index + 1} has no learning content.`);

  return {
    _clientId: createClientId('module'),
    title,
    description: clipText(firstDefined(source.description, source.summary, source.overview), 1_000, `${path}.description`, report),
    blocks,
  };
}

