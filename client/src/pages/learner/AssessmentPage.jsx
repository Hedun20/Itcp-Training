import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, Send } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { coursesApi } from '../../api/courses';
import { learningApi } from '../../api/learning';
import { Badge, ErrorState, LoadingState, TrainingButton, TrainingCard } from '../../branding/components';
import { FeedbackBanner } from '../../components/FeedbackBanner';
import { courseId } from '../../utils/format';

export function AssessmentPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState({ loading: true, course: null, error: '' });
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const load = useCallback(async () => {
    try { setState({ loading: false, course: await coursesApi.get(slug), error: '' }); }
    catch (error) { setState({ loading: false, course: null, error: error.message }); }
  }, [slug]);
  useEffect(() => { load(); }, [load]);
  const questions = useMemo(() => state.course?.assessment?.questions || state.course?.questions || [], [state.course]);
  const unanswered = questions.filter((question, index) => answers[question._id || question.id || index] === undefined).length;

  const submit = async (event) => {
    event.preventDefault();
    if (unanswered) {
      setSubmitError(`Answer all ${questions.length} questions before submitting.`);
      document.querySelector('.question-card:not(:has(input:checked))')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
      return;
    }
    setSubmitting(true);
    setSubmitError('');
    try {
      const payload = questions.map((question, index) => ({ questionId: question._id || question.id || String(index), selectedOptionIndex: answers[question._id || question.id || index] }));
      const attempt = await learningApi.submitAssessment(courseId(state.course), payload);
      navigate(`/courses/${state.course.slug || slug}/results/${attempt._id || attempt.id}`, { state: { attempt, course: state.course } });
    } catch (error) { setSubmitError(error.message || 'Your assessment could not be submitted.'); }
    finally { setSubmitting(false); }
  };

  if (state.loading) return <LoadingState label="Preparing assessment…" />;
  if (state.error || !state.course) return <ErrorState message={state.error || 'Assessment unavailable.'} onRetry={load} />;
  if (!questions.length) return <ErrorState title="Assessment not ready" message="This course does not have an assessment yet." />;
  return (
    <div className="assessment-page page-stack">
      <Link className="text-link back-link" to={`/courses/${state.course.slug || slug}`}><ArrowLeft size={16} />Back to course</Link>
      <header className="assessment-header"><div><div className="badge-row"><Badge tone="accent">{state.course.code}</Badge><Badge>{questions.length} questions</Badge></div><h1>Course assessment</h1><p>Choose the best answer for every question. Your score is calculated securely after submission.</p></div><TrainingCard className="pass-mark-card"><CheckCircle2 /><span><small>Passing score</small><strong>{state.course.passMark}%</strong></span></TrainingCard></header>
      {submitError && <FeedbackBanner tone="danger">{submitError}</FeedbackBanner>}
      <form onSubmit={submit} className="question-list">
        {questions.map((question, questionIndex) => { const key = question._id || question.id || questionIndex; return <TrainingCard as="fieldset" key={key} className="question-card"><legend><span>{questionIndex + 1}</span>{question.question || question.text}</legend>{question.points && <Badge>{question.points} point{question.points === 1 ? '' : 's'}</Badge>}<div className="option-list">{(question.options || []).map((option, optionIndex) => <label key={`${key}-${optionIndex}`} className={answers[key] === optionIndex ? 'selected' : ''}><input type="radio" name={`question-${key}`} value={optionIndex} checked={answers[key] === optionIndex} onChange={() => setAnswers((current) => ({ ...current, [key]: optionIndex }))} /><span className="option-letter">{String.fromCharCode(65 + optionIndex)}</span><span>{typeof option === 'string' ? option : option.text}</span></label>)}</div></TrainingCard>; })}
        <div className="assessment-submit"><span>{unanswered ? `${unanswered} unanswered` : 'All questions answered'}</span><TrainingButton type="submit" loading={submitting} icon={<Send size={18} />}>Submit assessment</TrainingButton></div>
      </form>
    </div>
  );
}
