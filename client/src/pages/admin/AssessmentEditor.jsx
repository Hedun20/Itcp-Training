import { useState } from 'react';
import { ArrowDown, ArrowUp, HelpCircle, Plus, Trash2 } from 'lucide-react';
import { EmptyState, TrainingButton, TrainingCard, TrainingInput, TrainingModal } from '../../branding/components';
import { createQuestion, moveItem } from '../../utils/courseEditor';

export function AssessmentEditor({ questions, errors, onChange }) {
  const [removeIndex, setRemoveIndex] = useState(null);
  const update = (index, nextQuestion) => onChange(questions.map((question, current) => current === index ? nextQuestion : question));
  const removeQuestion = () => {
    onChange(questions.filter((_, index) => index !== removeIndex));
    setRemoveIndex(null);
  };

  return (
    <div className="editor-section-stack">
      <div className="editor-section-heading"><div><p className="eyebrow">Knowledge check</p><h2>Assessment questions</h2><p>Correct answers are stored on the server and removed from learner course responses.</p></div><TrainingButton icon={<Plus />} onClick={() => onChange([...questions, createQuestion()])}>Add question</TrainingButton></div>
      {errors.assessment && <p className="inline-error" role="alert">{errors.assessment}</p>}
      {!questions.length ? <EmptyState title="No assessment questions" message="Add a question when this course needs a scored knowledge check." action={<TrainingButton icon={<HelpCircle />} onClick={() => onChange([createQuestion()])}>Add first question</TrainingButton>} /> : questions.map((question, questionIndex) => (
        <TrainingCard as="section" key={question._id || question._clientId} className="question-editor-card">
          <header>
            <span className="order-number">{questionIndex + 1}</span><strong>Question {questionIndex + 1}</strong>
            <div className="move-controls"><TrainingButton variant="ghost" iconOnly icon={<ArrowUp />} disabled={questionIndex === 0} onClick={() => onChange(moveItem(questions, questionIndex, questionIndex - 1))}>Move question up</TrainingButton><TrainingButton variant="ghost" iconOnly icon={<ArrowDown />} disabled={questionIndex === questions.length - 1} onClick={() => onChange(moveItem(questions, questionIndex, questionIndex + 1))}>Move question down</TrainingButton><TrainingButton variant="danger" iconOnly icon={<Trash2 />} onClick={() => setRemoveIndex(questionIndex)}>Remove question</TrainingButton></div>
          </header>
          <TrainingInput label="Question text" value={question.question || question.questionText || question.text || ''} onChange={(event) => update(questionIndex, { ...question, question: event.target.value })} error={errors[`question-${questionIndex}`]} multiline rows={3} />
          <fieldset className="answer-editor">
            <legend>Answer options <small>Select the correct answer.</small></legend>
            {(question.options || []).map((option, optionIndex) => (
              <div key={`${question._clientId || questionIndex}-${optionIndex}`} className="answer-option-editor">
                <label className="correct-choice"><input type="radio" name={`correct-${question._clientId || questionIndex}`} checked={Number(question.correctAnswer) === optionIndex} onChange={() => update(questionIndex, { ...question, correctAnswer: optionIndex })} /><span className="sr-only">Mark option {optionIndex + 1} correct</span></label>
                <TrainingInput aria-label={`Answer option ${optionIndex + 1}`} value={typeof option === 'string' ? option : option.text} onChange={(event) => update(questionIndex, { ...question, options: question.options.map((item, current) => current === optionIndex ? event.target.value : item) })} />
                <TrainingButton variant="ghost" iconOnly icon={<Trash2 />} disabled={question.options.length <= 2} onClick={() => { const nextOptions = question.options.filter((_, current) => current !== optionIndex); const correct = Number(question.correctAnswer); update(questionIndex, { ...question, options: nextOptions, correctAnswer: correct === optionIndex ? 0 : correct > optionIndex ? correct - 1 : correct }); }}>Remove option</TrainingButton>
              </div>
            ))}
            <TrainingButton variant="ghost" size="small" icon={<Plus />} onClick={() => update(questionIndex, { ...question, options: [...(question.options || []), ''] })}>Add answer option</TrainingButton>
          </fieldset>
          <div className="form-grid"><TrainingInput label="Explanation shown after submission" value={question.explanation || ''} onChange={(event) => update(questionIndex, { ...question, explanation: event.target.value })} multiline rows={3} maxLength={5000} /><TrainingInput label="Points" type="number" min="1" max="100" step="1" value={question.points ?? ''} onChange={(event) => update(questionIndex, { ...question, points: event.target.value })} error={errors[`question-${questionIndex}-points`]} /></div>
        </TrainingCard>
      ))}
      <TrainingModal open={removeIndex !== null} onClose={() => setRemoveIndex(null)} title="Remove this question?" description="This removes the question and its answer options from the working course." footer={<><TrainingButton variant="ghost" onClick={() => setRemoveIndex(null)}>Cancel</TrainingButton><TrainingButton variant="danger" onClick={removeQuestion}>Remove question</TrainingButton></>}><p>The deletion takes effect when you save the course.</p></TrainingModal>
    </div>
  );
}
