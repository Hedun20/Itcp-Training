import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, History, RotateCcw, Trophy, XCircle } from 'lucide-react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { learningApi } from '../../api/learning';
import { Badge, ErrorState, LoadingState, TrainingButton, TrainingCard } from '../../branding/components';
import { formatDateTime } from '../../utils/format';

function feedbackText(value, fallback = '') {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : fallback;
}

export function AssessmentResultPage() {
  const { slug, attemptId } = useParams();
  const location = useLocation();
  const [state, setState] = useState({ loading: !location.state?.attempt, attempt: location.state?.attempt || null, error: '' });
  const load = useCallback(async () => {
    try { setState({ loading: false, attempt: await learningApi.attempt(attemptId), error: '' }); }
    catch (error) { setState({ loading: false, attempt: null, error: error.message }); }
  }, [attemptId]);
  useEffect(() => { if (!state.attempt) load(); }, [load, state.attempt]);
  if (state.loading) return <LoadingState label="Loading your result…" />;
  if (state.error || !state.attempt) return <ErrorState title="Result unavailable" message={state.error || 'This assessment result could not be found.'} onRetry={load} />;
  const attempt = state.attempt;
  const percentage = Math.round(attempt.percentage ?? (attempt.maximumScore ? (attempt.score / attempt.maximumScore) * 100 : 0));
  return (
    <div className="result-page">
      <TrainingCard className={`result-hero ${attempt.passed ? 'result-hero--passed' : 'result-hero--retry'}`}>
        <span className="result-icon">{attempt.passed ? <Trophy /> : <RotateCcw />}</span>
        <Badge tone={attempt.passed ? 'success' : 'warning'}>{attempt.passed ? 'Assessment passed' : 'Keep learning'}</Badge>
        <h1>{attempt.passed ? 'Excellent work.' : 'You’re close.'}</h1>
        <p>{attempt.passed ? 'You met the course standard and completed this learning milestone.' : 'Review the course material and try again when you feel ready.'}</p>
        <div className="score-ring" aria-label={`Score ${percentage} percent`}><strong>{percentage}%</strong><span>{attempt.score} / {attempt.maximumScore} points</span></div>
        <small>Submitted {formatDateTime(attempt.submittedAt || attempt.createdAt)}</small>
        <div className="result-actions"><TrainingButton as={Link} to={`/courses/${slug}`} icon={attempt.passed ? <ArrowRight /> : <RotateCcw />}>{attempt.passed ? 'Return to course' : 'Review and retry'}</TrainingButton><TrainingButton as={Link} to="/history" variant="secondary" icon={<History />}>Attempt history</TrainingButton></div>
      </TrainingCard>
      {attempt.feedback?.length > 0 && <section className="result-review"><h2>Question review</h2>{attempt.feedback.map((item, index) => {
        const correct = item.correct === true || item.isCorrect === true || (item.correct === undefined && item.isCorrect === undefined && Number(item.pointsAwarded) > 0);
        const question = feedbackText(item.question ?? item.questionText, `Question ${index + 1}`);
        const explanation = feedbackText(item.explanation);
        return <TrainingCard key={feedbackText(item.questionId, String(index))} className="review-row"><span className={correct ? 'correct' : 'incorrect'} aria-label={correct ? 'Correct answer' : 'Incorrect answer'}>{correct ? <CheckCircle2 /> : <XCircle />}</span><div><strong>{question}</strong>{explanation && <p>{explanation}</p>}</div></TrainingCard>;
      })}</section>}
    </div>
  );
}
