import { useCallback, useEffect, useState } from 'react';
import { BookOpen, CheckCircle2, XCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { learningApi } from '../../api/learning';
import { Badge, EmptyState, ErrorState, LoadingState, TrainingButton, TrainingCard } from '../../branding/components';
import { PageHeader } from '../../components/PageHeader';
import { formatDateTime } from '../../utils/format';

export function AttemptHistoryPage() {
  const [state, setState] = useState({ loading: true, attempts: [], error: '' });
  const load = useCallback(async () => {
    try { setState({ loading: false, attempts: await learningApi.myAttempts(), error: '' }); }
    catch (error) { setState({ loading: false, attempts: [], error: error.message }); }
  }, []);
  useEffect(() => { load(); }, [load]);
  return (
    <div className="page-stack">
      <PageHeader eyebrow="Assessment record" title="Attempt history" description="Your scores are calculated and stored securely by ITCP Training." />
      {state.loading ? <LoadingState /> : state.error ? <ErrorState message={state.error} onRetry={load} /> : !state.attempts.length ? <EmptyState title="No assessment attempts yet" message="Complete a course assessment and the result will appear here." action={<TrainingButton as={Link} to="/courses" icon={<BookOpen />}>Explore courses</TrainingButton>} /> : <div className="history-list">{state.attempts.map((attempt) => { const course = attempt.course || (typeof attempt.courseId === 'object' ? attempt.courseId : {}); const percentage = Math.round(attempt.percentage ?? ((attempt.score / attempt.maximumScore) * 100)); return <TrainingCard as="article" key={attempt._id || attempt.id} className="history-row"><span className={`history-status ${attempt.passed ? 'passed' : 'failed'}`}>{attempt.passed ? <CheckCircle2 /> : <XCircle />}</span><div><div className="badge-row"><Badge tone={attempt.passed ? 'success' : 'warning'}>{attempt.passed ? 'Passed' : 'Not passed'}</Badge>{course.code && <Badge>{course.code}</Badge>}</div><h2>{course.title || attempt.courseTitle || 'Course assessment'}</h2><p>{formatDateTime(attempt.submittedAt || attempt.createdAt)}</p></div><div className="history-score"><strong>{percentage}%</strong><small>{attempt.score} / {attempt.maximumScore} points</small></div>{course.slug && <Link className="text-link" to={`/courses/${course.slug}/results/${attempt._id || attempt.id}`}>View result</Link>}</TrainingCard>; })}</div>}
    </div>
  );
}
