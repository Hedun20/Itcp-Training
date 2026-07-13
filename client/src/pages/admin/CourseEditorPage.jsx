import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, BookOpen, CheckCircle2, Save, Send } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { coursesApi } from '../../api/courses';
import { Badge, ErrorState, LoadingState, TrainingButton, TrainingCard } from '../../branding/components';
import { MediaPickerModal } from '../../components/MediaPickerModal';
import { FeedbackBanner } from '../../components/FeedbackBanner';
import { emptyCourse, normalizeCourseForEditor, prepareCoursePayload, validateCourseForm } from '../../utils/courseEditor';
import { courseId } from '../../utils/format';
import { AssessmentEditor } from './AssessmentEditor';
import { CourseMetadataForm } from './CourseMetadataForm';
import { ModuleEditor } from './ModuleEditor';

export function CourseEditorPage() {
  const { courseId: routeCourseId } = useParams();
  const editing = Boolean(routeCourseId);
  const navigate = useNavigate();
  const [course, setCourse] = useState(emptyCourse);
  const [loading, setLoading] = useState(editing);
  const [loadError, setLoadError] = useState('');
  const [errors, setErrors] = useState({});
  const [tab, setTab] = useState('details');
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [coverPickerOpen, setCoverPickerOpen] = useState(false);

  const load = useCallback(async () => {
    if (!editing) return;
    setLoading(true);
    try { setCourse(normalizeCourseForEditor(await coursesApi.get(routeCourseId))); setLoadError(''); }
    catch (error) { setLoadError(error.message); }
    finally { setLoading(false); }
  }, [editing, routeCourseId]);
  useEffect(() => { load(); }, [load]);

  const validateAndFocus = (isPublishing) => {
    const nextErrors = validateCourseForm(course, { publishing: isPublishing });
    setErrors(nextErrors);
    const first = Object.keys(nextErrors)[0];
    if (!first) return true;
    if (first.startsWith('module') || first.startsWith('block')) setTab('content');
    else if (first.startsWith('question') || first === 'assessment') setTab('assessment');
    else setTab('details');
    setFeedback({ tone: 'danger', message: `Please resolve ${Object.keys(nextErrors).length} validation issue${Object.keys(nextErrors).length === 1 ? '' : 's'} before ${isPublishing ? 'publishing' : 'saving'}.` });
    return false;
  };

  const persist = async ({ publish = false } = {}) => {
    if (!validateAndFocus(publish)) return;
    publish ? setPublishing(true) : setSaving(true);
    setFeedback(null);
    try {
      const payload = prepareCoursePayload(course);
      let saved = editing ? await coursesApi.update(routeCourseId, payload) : await coursesApi.create(payload);
      if (publish) saved = await coursesApi.changeStatus(courseId(saved), 'published');
      setCourse(normalizeCourseForEditor(saved));
      setFeedback({ tone: 'success', message: publish ? 'Course published and visible to learners.' : 'Course changes saved.' });
      if (!editing) navigate(`/admin/courses/${courseId(saved)}/edit`, { replace: true });
    } catch (error) {
      setFeedback({ tone: 'danger', message: error.message || 'Course could not be saved.' });
    } finally { setSaving(false); setPublishing(false); }
  };

  if (loading) return <LoadingState label="Loading course editor…" />;
  if (loadError) return <ErrorState title="Course could not be opened" message={loadError} onRetry={load} />;
  const tabs = [{ id: 'details', label: 'Course details' }, { id: 'content', label: `Modules (${course.modules.length})` }, { id: 'assessment', label: `Assessment (${course.assessment.questions.length})` }];
  return (
    <div className="course-editor-page">
      <header className="editor-topbar">
        <div><Link className="text-link back-link" to="/admin/courses"><ArrowLeft />Courses</Link><div className="editor-title-row"><div><p className="eyebrow">{editing ? 'Edit course' : 'New course'}</p><h1>{course.title || 'Untitled course'}</h1></div><Badge tone={course.status === 'published' ? 'success' : course.status === 'archived' ? 'neutral' : 'warning'}>{course.status}</Badge></div></div>
        <div className="page-actions"><TrainingButton variant="secondary" loading={saving} icon={<Save />} onClick={() => persist()}>Save {course.status === 'draft' ? 'draft' : 'changes'}</TrainingButton><TrainingButton loading={publishing} icon={<Send />} onClick={() => persist({ publish: true })}>{course.status === 'published' ? 'Validate & update' : 'Publish course'}</TrainingButton></div>
      </header>
      {feedback && <FeedbackBanner tone={feedback.tone} onDismiss={() => setFeedback(null)}>{feedback.message}</FeedbackBanner>}
      <TrainingCard className="editor-tabs" aria-label="Course editor sections">{tabs.map((item) => <button key={item.id} type="button" aria-pressed={tab === item.id} onClick={() => setTab(item.id)}>{item.id === 'details' ? <BookOpen /> : item.id === 'content' ? <CheckCircle2 /> : <Send />}{item.label}</button>)}</TrainingCard>
      <div>{tab === 'details' && <CourseMetadataForm course={course} errors={errors} onChange={setCourse} onChooseCover={() => setCoverPickerOpen(true)} />}{tab === 'content' && <ModuleEditor modules={course.modules} errors={errors} onChange={(modules) => setCourse((current) => ({ ...current, modules }))} />}{tab === 'assessment' && <AssessmentEditor questions={course.assessment.questions} errors={errors} onChange={(questions) => setCourse((current) => ({ ...current, assessment: { ...current.assessment, questions } }))} />}</div>
      <MediaPickerModal open={coverPickerOpen} onClose={() => setCoverPickerOpen(false)} title="Choose course cover" onSelect={(asset) => setCourse((current) => ({ ...current, coverImage: asset.url }))} />
    </div>
  );
}
