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

export function repairJsonCandidate(candidate) {
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
