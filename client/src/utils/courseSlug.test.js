import { describe, expect, it } from 'vitest';
import { createCourseSlug, createCourseSlugDraft, normalizeCourseSlug } from './courseSlug';

describe('createCourseSlug', () => {
  it('creates a lowercase URL slug from the full English title', () => {
    expect(createCourseSlug('Data Center Electrical Safety')).toBe('data-center-electrical-safety');
  });

  it('normalizes punctuation, whitespace and repeated separators', () => {
    expect(createCourseSlug('  Data Center: Safety & Access!  ')).toBe('data-center-safety-access');
  });

  it('normalizes German characters', () => {
    expect(createCourseSlug('Überprüfung der Geräte & Straße')).toBe('uberprufung-der-gerate-strasse');
  });

  it('transliterates Russian and Ukrainian Cyrillic', () => {
    expect(createCourseSlug('Основы безпеки дата-центру')).toBe('osnovy-bezpeki-data-tsentru');
  });

  it('clips long slugs without leaving a trailing hyphen', () => {
    expect(createCourseSlug('alpha beta gamma delta', { maxLength: 12 })).toBe('alpha-beta');
  });



  it('preserves a trailing separator while a custom slug is being typed', () => {
    expect(createCourseSlugDraft('data-center-')).toBe('data-center-');
    expect(createCourseSlugDraft('Überprüfung ')).toBe('uberprufung-');
  });

  it('extracts a slug when a full course URL is pasted', () => {
    expect(normalizeCourseSlug('https://training.example.com/courses/data-center-safety?preview=1')).toBe('data-center-safety');
  });

  it('uses the title when an imported slug is empty or unusable', () => {
    expect(normalizeCourseSlug('!!!', 'Data Center Safety')).toBe('data-center-safety');
  });
});
