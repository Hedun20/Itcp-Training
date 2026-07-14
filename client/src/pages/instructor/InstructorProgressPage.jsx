import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, GraduationCap, XCircle } from 'lucide-react';
import { instructorApi } from '../../api/instructor';
import { Badge, EmptyState, ErrorState, LoadingState, TrainingCard } from '../../branding/components';
import { PageHeader } from '../../components/PageHeader';
import { formatDateTime } from '../../utils/format';

export function InstructorProgressPage() {
  const [tab, setTab] = useState('progress');
  const [state, setState] = useState({ loading: true, progress: [], results: [], error: '' });
  const load = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: '' }));
    try {
      const [progress, results] = await Promise.all([instructorApi.progress(), instructorApi.results()]);
      setState({ loading: false, progress, results, error: '' });
    } catch (error) {
      setState({ loading: false, progress: [], results: [], error: error.message });
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const records = tab === 'progress' ? state.progress : state.results;
  return (
    <div className="page-stack">
      <PageHeader eyebrow="Your courses" title="Learner progress" description="Participation and assessment outcomes are limited to courses you own." />
      <TrainingCard className="editor-tabs" aria-label="Instructor reporting views">
        <button type="button" aria-pressed={tab === 'progress'} onClick={() => setTab('progress')}><GraduationCap />Course progress ({state.progress.length})</button>
        <button type="button" aria-pressed={tab === 'results'} onClick={() => setTab('results')}><CheckCircle2 />Assessment results ({state.results.length})</button>
      </TrainingCard>
      {state.loading ? <LoadingState label="Loading learner progress…" /> : state.error ? <ErrorState message={state.error} onRetry={load} /> : !records.length ? <EmptyState title="No learner activity yet" message="Activity for your courses will appear here when learners begin training." /> : tab === 'progress' ? (
        <div className="progress-list">{state.progress.map((record) => { const user = record.user || record.userId || {}; const course = record.course || record.courseId || {}; return <TrainingCard key={record._id || record.id} className="progress-record"><div className="progress-record__main"><div className="badge-row"><Badge tone={record.status === 'completed' ? 'success' : 'accent'}>{record.status?.replace('_', ' ')}</Badge><Badge>{course.code || record.courseCode}</Badge></div><h2>{course.title || record.courseTitle}</h2><p>{user.name || record.userName} · {user.email || record.userEmail}</p><div className="course-progress"><span><span>{record.completedModuleIds?.length || 0} modules complete</span><strong>{Math.round(record.percentage || 0)}%</strong></span><progress value={record.percentage || 0} max="100" /></div></div></TrainingCard>; })}</div>
      ) : (
        <div className="table-wrap"><table className="training-table"><thead><tr><th>Learner</th><th>Course</th><th>Score</th><th>Outcome</th><th>Submitted</th></tr></thead><tbody>{state.results.map((attempt) => { const user = attempt.user || attempt.userId || {}; const course = attempt.course || attempt.courseId || {}; return <tr key={attempt._id || attempt.id}><td><strong>{user.name || attempt.userName}</strong><small className="table-subline">{user.email || attempt.userEmail}</small></td><td><strong>{course.code || attempt.courseCode}</strong><small className="table-subline">{course.title || attempt.courseTitle}</small></td><td><strong>{Math.round(attempt.percentage ?? 0)}%</strong></td><td><Badge tone={attempt.passed ? 'success' : 'danger'}>{attempt.passed ? <CheckCircle2 /> : <XCircle />}{attempt.passed ? 'Passed' : 'Not passed'}</Badge></td><td>{formatDateTime(attempt.submittedAt)}</td></tr>; })}</tbody></table></div>
      )}
    </div>
  );
}
