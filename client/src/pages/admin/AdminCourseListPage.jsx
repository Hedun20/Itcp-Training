import { useCallback, useEffect, useMemo, useState } from 'react';
import { Archive, FilePlus2, Pencil, Search, Send, Undo2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { coursesApi } from '../../api/courses';
import { useAuth } from '../../auth/AuthContext';
import { Badge, EmptyState, ErrorState, LoadingState, TrainingButton, TrainingInput, TrainingModal, TrainingSelect } from '../../branding/components';
import { FeedbackBanner } from '../../components/FeedbackBanner';
import { PageHeader } from '../../components/PageHeader';
import { courseCoverUrl, courseId, formatDate } from '../../utils/format';

export function AdminCourseListPage() {
  const { user } = useAuth();
  const isInstructor = user?.role === 'instructor';
  const workspaceBase = isInstructor ? '/instructor' : '/admin';
  const [state, setState] = useState({ loading: true, courses: [], error: '' });
  const [filters, setFilters] = useState({ query: '', status: 'all' });
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const load = useCallback(async () => {
    try { setState({ loading: false, courses: await coursesApi.list({ limit: 100 }), error: '' }); }
    catch (error) { setState({ loading: false, courses: [], error: error.message }); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const visible = useMemo(() => state.courses.filter((course) => `${course.code} ${course.title}`.toLowerCase().includes(filters.query.toLowerCase()) && (filters.status === 'all' || course.status === filters.status)), [filters, state.courses]);
  const applyStatus = async () => {
    if (!confirm) return;
    setBusy(true);
    try {
      await coursesApi.changeStatus(courseId(confirm.course), confirm.status);
      setFeedback({ tone: 'success', message: `${confirm.course.title} is now ${confirm.status}.` });
      setConfirm(null);
      await load();
    } catch (error) { setFeedback({ tone: 'danger', message: error.message }); }
    finally { setBusy(false); }
  };
  return (
    <div className="page-stack">
      <PageHeader eyebrow={isInstructor ? 'Instructor workspace' : 'Course management'} title={isInstructor ? 'My courses' : 'Courses'} description={isInstructor ? 'Create and edit courses you own. Publishing and catalog administration remain with administrators.' : 'Create, review, publish, and archive the learning catalog.'} actions={<TrainingButton as={Link} to={`${workspaceBase}/courses/new`} icon={<FilePlus2 />}>Create course</TrainingButton>} />
      {feedback && <FeedbackBanner tone={feedback.tone} onDismiss={() => setFeedback(null)}>{feedback.message}</FeedbackBanner>}
      <div className="filter-bar"><div className="search-field"><Search /><TrainingInput aria-label="Search courses" placeholder="Search courses" value={filters.query} onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))} /></div><TrainingSelect aria-label="Filter course status" value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}><option value="all">All statuses</option><option value="published">Published</option><option value="draft">Draft</option><option value="archived">Archived</option></TrainingSelect></div>
      {state.loading ? <LoadingState /> : state.error ? <ErrorState message={state.error} onRetry={load} /> : visible.length ? (
        <div className="admin-course-list">{visible.map((course) => (
          <article key={courseId(course)} className="admin-course-row">
            <img src={courseCoverUrl(course)} alt="" />
            <div className="admin-course-row__main"><div className="badge-row"><Badge tone={course.status === 'published' ? 'success' : course.status === 'draft' ? 'warning' : 'neutral'}>{course.status}</Badge><Badge>{course.code}</Badge></div><h2>{course.title}</h2><p>{course.shortDescription}</p><small>{course.modules?.length ?? course.moduleCount ?? 0} modules · Updated {formatDate(course.updatedAt)}</small></div>
            <div className="row-actions">
              <TrainingButton as={Link} to={`${workspaceBase}/courses/${courseId(course)}/edit`} variant="secondary" size="small" icon={<Pencil />}>Edit</TrainingButton>
              {!isInstructor && (course.status === 'published' ? <TrainingButton variant="ghost" size="small" icon={<Undo2 />} onClick={() => setConfirm({ course, status: 'draft' })}>Unpublish</TrainingButton> : course.status !== 'archived' && <TrainingButton variant="ghost" size="small" icon={<Send />} onClick={() => setConfirm({ course, status: 'published' })}>Publish</TrainingButton>)}
              {!isInstructor && course.status !== 'archived' && <TrainingButton variant="danger" size="small" icon={<Archive />} onClick={() => setConfirm({ course, status: 'archived' })}>Archive</TrainingButton>}
            </div>
          </article>
        ))}</div>
      ) : <EmptyState title={isInstructor ? 'No owned courses match' : 'No courses match'} message={isInstructor ? 'Adjust the filters or create your first course.' : 'Adjust the filters or create a new course.'} />}
      <TrainingModal open={Boolean(confirm)} onClose={() => setConfirm(null)} title={`${confirm?.status === 'published' ? 'Publish' : confirm?.status === 'archived' ? 'Archive' : 'Unpublish'} course?`} description={confirm?.status === 'published' ? 'Publishing makes this course visible to learners.' : confirm?.status === 'archived' ? 'Archived courses leave the active catalog but retain historical records.' : 'Learners will no longer find this course in the catalog.'} footer={<><TrainingButton variant="ghost" onClick={() => setConfirm(null)}>Cancel</TrainingButton><TrainingButton variant={confirm?.status === 'archived' ? 'danger' : 'primary'} loading={busy} onClick={applyStatus}>Confirm</TrainingButton></>}><p><strong>{confirm?.course.title}</strong></p></TrainingModal>
    </div>
  );
}
