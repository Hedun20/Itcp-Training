const CYRILLIC_TRANSLITERATION = Object.freeze({
  а: 'a', б: 'b', в: 'v', г: 'g', ґ: 'g', д: 'd', е: 'e', ё: 'e', є: 'ye', ж: 'zh',
  з: 'z', и: 'i', і: 'i', ї: 'yi', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o',
  п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch',
  ш: 'sh', щ: 'shch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
});

const SPECIAL_LATIN_TRANSLITERATION = Object.freeze({
  ß: 'ss', æ: 'ae', œ: 'oe', ø: 'o', đ: 'd', ð: 'd', ł: 'l', þ: 'th',
});

function transliterate(value) {
  return Array.from(value).map((character) => {
    const lower = character.toLowerCase();
    return CYRILLIC_TRANSLITERATION[lower]
      ?? SPECIAL_LATIN_TRANSLITERATION[lower]
      ?? character;
  }).join('');
}

export function createCourseSlug(value, { maxLength = 160 } = {}) {
  if (!Number.isInteger(maxLength) || maxLength < 1) {
    throw new TypeError('maxLength must be a positive integer.');
  }

  const slug = transliterate(String(value ?? ''))
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');

  if (slug.length <= maxLength) return slug;
  const clipped = slug.slice(0, maxLength).replace(/-+$/g, '');
  if (slug[maxLength] !== '-' && clipped.includes('-')) {
    return clipped.slice(0, clipped.lastIndexOf('-')) || clipped;
  }
  return clipped;
}

function extractSlugValue(value) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  if (/^https?:\/\//i.test(text)) {
    try {
      const url = new URL(text);
      const segments = url.pathname.split('/').filter(Boolean);
      return decodeURIComponent(segments.at(-1) || '');
    } catch {
      return text;
    }
  }
  return text;
}


export function createCourseSlugDraft(value, { maxLength = 160 } = {}) {
  if (!Number.isInteger(maxLength) || maxLength < 1) {
    throw new TypeError('maxLength must be a positive integer.');
  }
  const source = /^https?:\/\//i.test(String(value ?? '').trim()) ? extractSlugValue(value) : String(value ?? '');
  return transliterate(source)
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+/g, '')
    .slice(0, maxLength);
}

export function normalizeCourseSlug(value, fallbackTitle = '') {
  return createCourseSlug(extractSlugValue(value)) || createCourseSlug(fallbackTitle);
}
