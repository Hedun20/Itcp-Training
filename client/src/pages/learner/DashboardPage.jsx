import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, BookOpen, CheckCircle2, Clock3, Flame } from 'lucide-react';
import { Link } from 'react-router-dom';
import { coursesApi } from '../../api/courses';
import { learningApi } from '../../api/learning';
import { useAuth } from '../../auth/AuthContext';
import { ErrorState, LoadingState, TrainingButton, TrainingCard } from '../../branding/components';
import { CourseCard } from '../../components/CourseCard';
import { PageHeader } from '../../components/PageHeader';
import { completionPercentage, courseFromRecord, courseId } from '../../utils/format';

export function DashboardPage() {
  const { user } = useAuth();
  const [state, setState] = useState({ loading: true, courses: [], progress: [], attempts: [], error: '' });
  const load = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: '' }));
    try {
      const [courses, progress, attempts] = await Promise.all([coursesApi.list(), learningApi.myProgress(), learningApi.myAttempts()]);
      setState({ loading: false, courses, progress, attempts, error: '' });
    } catch (error) {
      setState((current) => ({ ...current, loading: false, error: error.message }));
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const active = useMemo(() => state.progress.filter((item) => item.status === 'in_progress'), [state.progress]);
  const completed = state.progress.filter((item) => item.status === 'completed');
  const progressByCourse = useMemo(() => new Map(state.progress.filter((item) => item.status !== 'not_started').map((item) => [String(item.courseId?._id || item.courseId || item.course?._id), item])), [state.progress]);
  const recommended = state.courses.filter((course) => !progressByCourse.has(String(courseId(course)))).slice(0, 3);

  if (state.loading) return <LoadingState />;
  if (state.error) return <ErrorState message={state.error} onRetry={load} />;

  return (
    <div className="page-stack">
      <PageHeader eyebrow="Learner workspace" title={`Welcome back, ${user?.name?.split(' ')[0] || 'learner'}`} description="Keep your momentum. Your next useful step is ready." actions={<TrainingButton as={Link} to="/courses" variant="secondary" icon={<BookOpen size={18} />}>Browse courses</TrainingButton>} />
      <section className="metric-grid attention-group" aria-label="Learning overview">
        <TrainingCard interactive className="metric-card"><span className="metric-icon"><Flame /></span><small>Active courses</small><strong>{active.length}</strong><p>{active.length ? 'Ready to resume' : 'Choose a course to begin'}</p></TrainingCard>
        <TrainingCard interactive className="metric-card"><span className="metric-icon metric-icon--green"><CheckCircle2 /></span><small>Courses completed</small><strong>{completed.length}</strong><p>Verified learning milestones</p></TrainingCard>
        <TrainingCard interactive className="metric-card"><span className="metric-icon metric-icon--cyan"><Clock3 /></span><small>Assessment attempts</small><strong>{state.attempts.length}</strong><p>Your personal attempt history</p></TrainingCard>
      </section>

      {active.length > 0 && <section className="content-section"><div className="section-heading"><div><p className="eyebrow">Continue learning</p><h2>Pick up where you stopped</h2></div><Link className="text-link" to="/progress">View all progress <ArrowRight size={16} /></Link></div><div className="course-grid">{active.slice(0, 3).map((item) => { const course = state.courses.find((candidate) => String(courseId(candidate)) === String(item.courseId)) || courseFromRecord(item); return course ? <CourseCard key={item._id || item.id || courseId(course)} course={course} progress={{ ...item, percentage: completionPercentage(item, course.modules?.length || course.moduleCount) }} /> : null; })}</div></section>}

      <section className="content-section">
        <div className="section-heading"><div><p className="eyebrow">Course catalog</p><h2>{recommended.length ? 'Your next capability' : 'Explore more training'}</h2></div><Link className="text-link" to="/courses">See full catalog <ArrowRight size={16} /></Link></div>
        {recommended.length ? <div className="course-grid">{recommended.map((course) => <CourseCard key={courseId(course)} course={course} />)}</div> : <TrainingCard className="compact-message"><CheckCircle2 /><span><strong>You have started every available course.</strong><small>Continue an active course or revisit completed material.</small></span></TrainingCard>}
      </section>
    </div>
  );
}
