import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Download, GraduationCap, UsersRound, XCircle } from 'lucide-react';
import { adminApi } from '../../api/admin';
import { Badge, EmptyState, ErrorState, LoadingState, TrainingButton, TrainingCard } from '../../branding/components';
import { FeedbackBanner } from '../../components/FeedbackBanner';
import { LearnerRecords } from '../../components/LearnerRecords';
import { PageHeader } from '../../components/PageHeader';
import { formatDateTime } from '../../utils/format';

export function AdminResultsPage() {
  const [tab, setTab] = useState('learners');
  const [state, setState] = useState({ loading: true, results: [], progress: [], error: '' });
  const [exporting, setExporting] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const load = useCallback(async () => {
    try {
      const [results, progress] = await Promise.all([adminApi.results(), adminApi.progress()]);
      setState({ loading: false, results, progress, error: '' });
    } catch (error) {
      setState((current) => ({ ...current, loading: false, error: error.message }));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const exportCsv = async () => {
    setExporting(true);
    try {
      const blob = await adminApi.exportResults();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `itcp-training-results-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      setFeedback({ tone: 'success', message: 'Results CSV downloaded.' });
    } catch (error) {
      setFeedback({ tone: 'danger', message: error.message });
    } finally {
      setExporting(false);
    }
  };

  const records = tab === 'results' ? state.results : state.progress;

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Learning intelligence"
        title="Progress & results"
        description="Open a learner record to review their complete course progress and assessment history."
        actions={<TrainingButton variant="secondary" loading={exporting} icon={<Download />} onClick={exportCsv}>Export results CSV</TrainingButton>}
      />
      {feedback && <FeedbackBanner tone={feedback.tone} onDismiss={() => setFeedback(null)}>{feedback.message}</FeedbackBanner>}

      <TrainingCard className="editor-tabs" aria-label="Result views">
        <button type="button" aria-pressed={tab === 'learners'} onClick={() => setTab('learners')}>
          <UsersRound />Learners
        </button>
        <button type="button" aria-pressed={tab === 'results'} onClick={() => setTab('results')}>
          <CheckCircle2 />Assessment results ({state.results.length})
        </button>
        <button type="button" aria-pressed={tab === 'progress'} onClick={() => setTab('progress')}>
          <GraduationCap />Course progress ({state.progress.length})
        </button>
      </TrainingCard>

      {state.loading ? (
        <LoadingState />
      ) : state.error ? (
        <ErrorState message={state.error} onRetry={load} />
      ) : tab === 'learners' ? (
        <LearnerRecords progress={state.progress} results={state.results} />
      ) : !records.length ? (
        <EmptyState
          title={tab === 'results' ? 'No assessment results yet' : 'No course progress yet'}
          message="Learner activity will appear here as training begins."
        />
      ) : tab === 'results' ? (
        <div className="table-wrap">
          <table className="training-table">
            <thead><tr><th>Learner</th><th>Course</th><th>Score</th><th>Outcome</th><th>Submitted</th></tr></thead>
            <tbody>
              {state.results.map((attempt) => {
                const user = attempt.user || attempt.userId || {};
                const course = attempt.course || attempt.courseId || {};
                return (
                  <tr key={attempt._id || attempt.id}>
                    <td><strong>{user.name || attempt.userName}</strong><small className="table-subline">{user.email || attempt.userEmail}</small></td>
                    <td><strong>{course.code || attempt.courseCode}</strong><small className="table-subline">{course.title || attempt.courseTitle}</small></td>
                    <td><strong>{Math.round(attempt.percentage ?? 0)}%</strong><small className="table-subline">{attempt.score}/{attempt.maximumScore} points</small></td>
                    <td><Badge tone={attempt.passed ? 'success' : 'danger'}>{attempt.passed ? <CheckCircle2 /> : <XCircle />}{attempt.passed ? 'Passed' : 'Not passed'}</Badge></td>
                    <td>{formatDateTime(attempt.submittedAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="progress-list">
          {state.progress.map((record) => {
            const user = record.user || record.userId || {};
            const course = record.course || record.courseId || {};
            return (
              <TrainingCard key={record._id || record.id} className="progress-record">
                <div>
                  <div className="badge-row">
                    <Badge tone={record.status === 'completed' ? 'success' : 'accent'}>{record.status?.replace('_', ' ')}</Badge>
                    <Badge>{course.code}</Badge>
                  </div>
                  <h2>{course.title || record.courseTitle}</h2>
                  <p>{user.name || record.userName} · {user.email || record.userEmail}</p>
                  <div className="course-progress">
                    <span>
                      <span>{record.completedModuleIds?.length || 0} modules complete</span>
                      <strong>{record.percentage || 0}%</strong>
                    </span>
                    <progress value={record.percentage || 0} max="100" />
                  </div>
                </div>
              </TrainingCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
