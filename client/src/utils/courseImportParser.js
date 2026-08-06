import { CourseImportError } from './courseImportCore';
import { repairJsonCandidate } from './courseImportJsonRepair';

function extractBalancedJson(text) {
  const cleaned = String(text ?? '').replace(/^\uFEFF/, '').trim();
  const withoutFence = cleaned
    .replace(/^```(?:json|javascript|js)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();

  const start = withoutFence.search(/[[{]/);
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

export function parseJsonText(rawText) {
  const candidate = extractBalancedJson(rawText);
  try {
    return { value: JSON.parse(candidate), repairs: [] };
  } catch (strictError) {
    const repaired = repairJsonCandidate(candidate);
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
