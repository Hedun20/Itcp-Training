export class CourseImportError extends Error {
  constructor(message, { code = 'COURSE_IMPORT_FAILED', cause, details } = {}) {
    super(message, { cause });
    this.name = 'CourseImportError';
    this.code = code;
    this.details = details;
  }
}

export function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null);
}

export function toText(value) {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

export function toArray(value) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === '') return [];
  return [value];
}

export function addFixed(report, path, message) {
  report.autoFixed.push({ path, message });
}

export function addReview(report, path, message) {
  report.reviewRequired.push({ path, message });
}

export function clipText(value, maxLength, path, report) {
  const text = toText(value);
  if (text.length <= maxLength) return text;
  addFixed(report, path, `Content was shortened to ${maxLength} characters.`);
  return text.slice(0, maxLength).trimEnd();
}

export function clampNumber(value, { min, max, fallback, integer = false }, path, report) {
  const parsed = typeof value === 'string' && value.trim() !== ''
    ? Number(value.trim().replace(/%$/, ''))
    : value;
  if (!Number.isFinite(parsed)) {
    if (value !== undefined && value !== null && value !== '') addFixed(report, path, `Invalid number was replaced with ${fallback}.`);
    return fallback;
  }
  const normalized = integer ? Math.round(parsed) : parsed;
  const clamped = Math.min(max, Math.max(min, normalized));
  if (clamped !== parsed) addFixed(report, path, `Value was constrained to the supported range ${min}-${max}.`);
  return clamped;
}

function mapOutsideDoubleQuotedStrings(text, mapper) {
  let output = '';
  let outside = '';
  let insideString = false;
  let escaped = false;

  const flushOutside = () => {
    if (!outside) return;
    output += mapper(outside);
    outside = '';
  };

  for (const character of text) {
    if (!insideString) {
      if (character === '"') {
        flushOutside();
        insideString = true;
        output += character;
      } else {
        outside += character;
      }
      continue;
    }

    output += character;
    if (escaped) escaped = false;
    else if (character === '\\') escaped = true;
    else if (character === '"') insideString = false;
  }

  flushOutside();
  return output;
}

function stripJsonComments(text) {
  let output = '';
  let quote = null;
  let escaped = false;
  let index = 0;

  while (index < text.length) {
    const character = text[index];
    const next = text[index + 1];

    if (quote) {
      output += character;
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === quote) quote = null;
      index += 1;
      continue;
    }

    if (character === '"' || character === "'") {
      quote = character;
      output += character;
      index += 1;
      continue;
    }

    if (character === '/' && next === '/') {
      index += 2;
      while (index < text.length && text[index] !== '\n') index += 1;
      continue;
    }

    if (character === '/' && next === '*') {
      index += 2;
      while (index < text.length && !(text[index] === '*' && text[index + 1] === '/')) index += 1;
      index = Math.min(text.length, index + 2);
      continue;
    }

    output += character;
    index += 1;
  }

  return output;
}

function convertSingleQuotedStrings(text) {
  let output = '';
  let quote = null;
  let escaped = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];

    if (!quote) {
      if (character === "'") {
        quote = "'";
        output += '"';
      } else {
        if (character === '"') quote = '"';
        output += character;
      }
      continue;
    }

    if (quote === '"') {
      output += character;
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') quote = null;
      continue;
    }

    if (escaped) {
      if (character === "'") output += "'";
      else if (character === '"') output += '\\"';
      else output += `\\${character}`;
      escaped = false;
      continue;
    }

    if (character === '\\') {
      escaped = true;
      continue;
    }
    if (character === "'") {
      let lookAhead = index + 1;
      while (lookAhead < text.length && /\s/.test(text[lookAhead])) lookAhead += 1;
      if (lookAhead < text.length && ![',', '}', ']', ':'].includes(text[lookAhead])) {
        output += "'";
        continue;
      }
      quote = null;
      output += '"';
      continue;
    }
    if (character === '"') output += '\\"';
    else output += character;
  }

  if (escaped) output += '\\';
  return output;
}

function removeTrailingCommas(text) {
  let output = '';
  let insideString = false;
  let escaped = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (insideString) {
      output += character;
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') insideString = false;
      continue;
    }

    if (character === '"') {
      insideString = true;
      output += character;
      continue;
    }

    if (character === ',') {
      let lookAhead = index + 1;
      while (lookAhead < text.length && /\s/.test(text[lookAhead])) lookAhead += 1;
      if (text[lookAhead] === '}' || text[lookAhead] === ']') continue;
    }

    output += character;
  }

  return output;
}

function extractBalancedJson(text) {
  const cleaned = String(text ?? '').replace(/^\uFEFF/, '').trim();
  const withoutFence = cleaned
    .replace(/^```(?:json|javascript|js)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();

  const start = withoutFence.search(/[\[{]/);
  if (start < 0) throw new CourseImportError('No JSON object was found in the selected file.', { code: 'JSON_NOT_FOUND' });

  const stack = [];
  let quote = null;
  let escaped = false;

  for (let index = start; index < withoutFence.length; index += 1) {
    const character = withoutFence[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === quote) quote = null;
      continue;
    }

    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (character === '{' || character === '[') stack.push(character);
    if (character === '}' || character === ']') {
      const expected = character === '}' ? '{' : '[';
      if (stack.at(-1) !== expected) throw new CourseImportError('The JSON contains mismatched brackets.', { code: 'JSON_BRACKETS_INVALID' });
      stack.pop();
      if (!stack.length) return withoutFence.slice(start, index + 1);
    }
  }

  throw new CourseImportError('The JSON object is incomplete or has an unclosed bracket.', { code: 'JSON_INCOMPLETE' });
}

function repairJson(candidate) {
  const repairs = [];
  let repaired = candidate.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");

  const withoutComments = stripJsonComments(repaired);
  if (withoutComments !== repaired) repairs.push('Comments were removed.');
  repaired = withoutComments;

  const withDoubleQuotes = convertSingleQuotedStrings(repaired);
  if (withDoubleQuotes !== repaired) repairs.push('Single-quoted strings were converted to JSON strings.');
  repaired = withDoubleQuotes;

  const withQuotedKeys = mapOutsideDoubleQuotedStrings(repaired, (outside) => outside.replace(
    /(^|[,{]\s*)([A-Za-z_$][A-Za-z0-9_$-]*)(\s*:)/g,
    '$1"$2"$3',
  ));
  if (withQuotedKeys !== repaired) repairs.push('Unquoted property names were quoted.');
  repaired = withQuotedKeys;

  const withJsonLiterals = mapOutsideDoubleQuotedStrings(repaired, (outside) => outside
    .replace(/\bTrue\b/g, 'true')
    .replace(/\bFalse\b/g, 'false')
    .replace(/\bNone\b/g, 'null'));
  if (withJsonLiterals !== repaired) repairs.push('Python-style values were converted to JSON values.');
  repaired = withJsonLiterals;

  const withoutTrailingCommas = removeTrailingCommas(repaired);
  if (withoutTrailingCommas !== repaired) repairs.push('Trailing commas were removed.');

  return { text: withoutTrailingCommas, repairs };
}

export function parseJsonText(rawText) {
  const candidate = extractBalancedJson(rawText);
  try {
    return { value: JSON.parse(candidate), repairs: [] };
  } catch (strictError) {
    const repaired = repairJson(candidate);
    try {
      return { value: JSON.parse(repaired.text), repairs: repaired.repairs };
    } catch (repairError) {
      throw new CourseImportError('The file contains JSON that could not be repaired safely.', {
        code: 'JSON_PARSE_FAILED',
        cause: repairError,
        details: { strictError: strictError.message, repairedError: repairError.message },
      });
    }
  }
}

