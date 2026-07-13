import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, Award, BookOpen, Clock3 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { coursesApi } from '../../api/courses';
import { learningApi } from '../../api/learning';
import { Badge, EmptyState, ErrorState, LoadingState, TrainingButton, TrainingCard } from '../../branding/components';
import { PageHeader } from '../../components/PageHeader';
import { completionPercentage, courseFromRecord, courseId, formatDate } from '../../utils/format';

function statusLabel(status) {
  if (status === 'completed') return 'Completed';
  if (status === 'in_progress') return 'In progress';
  return 'Not started';
}

export function ProgressPage() {
  const [state, setState] = useState({ loading: true, progress: [], courses: [], error: '' });
  const load = useCallback(async () => {
    try {
      const [progress, courses] = await Promise.all([learningApi.myProgress(), coursesApi.list()]);
      setState({ loading: false, progress, courses, error: '' });
    } catch (error) { setState((current) => ({ ...current, loading: false, error: error.message })); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const courseMap = useMemo(() => new Map(state.courses.map((course) => [String(courseId(course)), course])), [state.courses]);

  if (state.loading) return <LoadingState />;
  if (state.error) return <ErrorState message={state.error} onRetry={load} />;
  return (
    <div className="page-stack">
      <PageHeader eyebrow="Learning record" title="My progress" description="A clear view of active courses and completed milestones." />
      {!state.progress.length ? <EmptyState title="No learning progress yet" message="Start a published course and your progress will appear here." action={<TrainingButton as={Link} to="/courses" icon={<BookOpen />}>Browse courses</TrainingButton>} /> : (
        <div className="progress-list">{state.progress.map((item) => {
          const course = courseMap.get(String(item.courseId)) || courseFromRecord(item);
          if (!course) return null;
          const percentage = completionPercentage(item, course.modules?.length || course.moduleCount);
          return (
            <TrainingCard as="article" key={item._id || item.id || `${courseId(course)}-${item.status}`} interactive className="progress-record">
              <div className="progress-record__main">
                <div className="badge-row"><Badge tone={item.status === 'completed' ? 'success' : item.status === 'in_progress' ? 'accent' : 'neutral'}>{statusLabel(item.status)}</Badge><Badge>{course.code}</Badge></div>
                <h2>{course.title}</h2>
                <div className="record-meta"><span><Clock3 />Last opened {formatDate(item.lastAccessedAt)}</span>{item.bestScore !== undefined && <span><Award />Best score {item.bestScore}%</span>}</div>
                <div className="course-progress"><span><span>{item.completedModuleIds?.length || 0} of {course.modules?.length || course.moduleCount || 0} modules</span><strong>{percentage}%</strong></span><progress max="100" value={percentage}>{percentage}%</progress></div>
              </div>
              <TrainingButton as={Link} to={`/courses/${course.slug || courseId(course)}/learn/${item.currentModuleIndex || 0}`} variant="secondary">{item.status === 'completed' ? 'Review' : item.status === 'not_started' ? 'Start' : 'Continue'} <ArrowRight size={17} /></TrainingButton>
            </TrainingCard>
          );
        })}</div>
      )}
    </div>
  );
}
