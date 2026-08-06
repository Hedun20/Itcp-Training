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

function optionText(option) {
  return isPlainObject(option) ? toText(firstDefined(option.text, option.label, option.answer, option.value)) : toText(option);
}

function resolveCorrectAnswer(source, rawOptions, options, path, report) {
  const flaggedIndexes = rawOptions.reduce((indexes, option, index) => {
    if (isPlainObject(option) && (option.isCorrect === true || option.correct === true)) indexes.push(index);
    return indexes;
  }, []);
  if (flaggedIndexes.length > 1) {
    addReview(report, `${path}.correctAnswer`, 'Multiple correct answers were provided, but this editor supports one. The first marked answer was selected.');
  }
  if (flaggedIndexes.length) return flaggedIndexes[0];

  const indexed = firstDefined(source.correctOptionIndex, source.correctAnswerIndex, source.correctIndex);
  if (indexed !== undefined && Number.isInteger(Number(indexed))) return Number(indexed);

  const oneBased = firstDefined(source.correctOptionNumber, source.correctAnswerNumber);
  if (oneBased !== undefined && Number.isInteger(Number(oneBased))) {
    addFixed(report, `${path}.correctAnswer`, 'A one-based answer number was converted to a zero-based index.');
    return Number(oneBased) - 1;
  }

  const answer = firstDefined(source.correctAnswer, source.answer, source.correctOption);
  if (typeof answer === 'boolean') {
    const expected = answer ? ['true', 'yes'] : ['false', 'no'];
    return options.findIndex((option) => expected.includes(option.toLowerCase()));
  }
  if (typeof answer === 'string') {
    const trimmed = answer.trim();
    const exactIndex = options.findIndex((option) => option.toLowerCase() === trimmed.toLowerCase());
    if (exactIndex >= 0) return exactIndex;
    if (/^[A-L]$/i.test(trimmed)) return trimmed.toUpperCase().charCodeAt(0) - 65;
    if (/^\d+$/.test(trimmed)) return Number(trimmed);
  }
  if (Number.isInteger(Number(answer)) && answer !== '' && answer !== null && answer !== undefined) return Number(answer);
  return -1;
}

export function normalizeQuestion(rawQuestion, index, report) {
  const path = `course.assessment.questions[${index}]`;
  const source = isPlainObject(rawQuestion) ? rawQuestion : { questionText: rawQuestion };
  const question = clipText(firstDefined(source.questionText, source.question, source.prompt, source.text), 5_000, `${path}.questionText`, report);
  if (!question) addReview(report, `${path}.questionText`, `Question ${index + 1} needs question text.`);

  const questionType = toText(firstDefined(source.type, source.questionType)).toLowerCase().replace(/[\s-]+/g, '_');
  let rawOptions = toArray(firstDefined(source.options, source.answers, source.choices));
  if (!rawOptions.length && ['true_false', 'truefalse', 'boolean'].includes(questionType)) {
    rawOptions = ['True', 'False'];
    addFixed(report, `${path}.options`, 'True/false answer options were generated automatically.');
  }
  if (['multiple_choice', 'multiple_select', 'multi_select'].includes(questionType)) {
    addReview(report, `${path}.type`, 'Multiple-answer questions are not supported yet. Review the selected correct answer.');
  }

  let optionEntries = rawOptions
    .map((rawOption) => ({ rawOption, text: optionText(rawOption) }))
    .filter((entry) => entry.text);
  if (optionEntries.length > 12) {
    optionEntries = optionEntries.slice(0, 12);
    addFixed(report, `${path}.options`, 'Only the first 12 answer options were imported.');
  }
  let options = optionEntries.map((entry, optionIndex) => clipText(entry.text, 2_000, `${path}.options[${optionIndex}]`, report));
  while (options.length < 2) {
    options.push('Review answer option');
    addReview(report, `${path}.options`, `Question ${index + 1} needs at least two complete answer options.`);
  }

  let correctAnswer = resolveCorrectAnswer(source, optionEntries.map((entry) => entry.rawOption), options, path, report);
  if (!Number.isInteger(correctAnswer) || correctAnswer < 0 || correctAnswer >= options.length) {
    correctAnswer = 0;
    addReview(report, `${path}.correctAnswer`, `Question ${index + 1} needs a valid correct answer.`);
  }

  return {
    _clientId: createClientId('question'),
    question,
    options,
    correctAnswer,
    explanation: clipText(firstDefined(source.explanation, source.feedback, source.rationale), 5_000, `${path}.explanation`, report),
    points: clampNumber(source.points, { min: 1, max: 100, fallback: 1, integer: true }, `${path}.points`, report),
  };
}

