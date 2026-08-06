import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, BookOpen, CheckCircle2, FileJson2, Save, Send } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { coursesApi } from '../../api/courses';
import { useAuth } from '../../auth/AuthContext';
import { Badge, ErrorState, LoadingState, TrainingButton, TrainingCard } from '../../branding/components';
import { MediaPickerModal } from '../../components/MediaPickerModal';
import { FeedbackBanner } from '../../components/FeedbackBanner';
import { emptyCourse, normalizeCourseForEditor, prepareCoursePayload, validateCourseForm } from '../../utils/courseEditor';
import { createCourseSlug, createCourseSlugDraft, normalizeCourseSlug } from '../../utils/courseSlug';
import { courseId } from '../../utils/format';
import { AssessmentEditor } from './AssessmentEditor';
import { CourseImportModal } from './CourseImportModal';
import { CourseMetadataForm } from './CourseMetadataForm';
import { ModuleEditor } from './ModuleEditor';

export function CourseEditorPage() {
  const { user } = useAuth();
  const isInstructor = user?.role === 'instructor';
  const workspaceBase = isInstructor ? '/instructor' : '/admin';
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
  const [importOpen, setImportOpen] = useState(false);
  const [slugMode, setSlugMode] = useState(editing ? 'manual' : 'auto');

  const load = useCallback(async () => {
    if (!editing) return;
    setLoading(true);
    try {
      setCourse(normalizeCourseForEditor(await coursesApi.get(routeCourseId)));
      setSlugMode('manual');
      setLoadError('');
    } catch (error) {
      setLoadError(error.message);
    } finally {
      setLoading(false);
    }
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
      setSlugMode('manual');
      setFeedback({ tone: 'success', message: publish ? 'Course published and visible to learners.' : 'Course changes saved.' });
      if (!editing) navigate(`${workspaceBase}/courses/${courseId(saved)}/edit`, { replace: true });
    } catch (error) {
      setFeedback({ tone: 'danger', message: error.message || 'Course could not be saved.' });
    } finally {
      setSaving(false);
      setPublishing(false);
    }
  };

  const updateTitle = (title) => {
    setCourse((current) => ({
      ...current,
      title,
      slug: slugMode === 'auto' ? createCourseSlug(title) : current.slug,
    }));
  };

  const updateSlug = (value) => {
    const trimmed = value.trim();
    if (!trimmed) {
      setSlugMode('auto');
      setCourse((current) => ({ ...current, slug: createCourseSlug(current.title) }));
      return;
    }
    setSlugMode('manual');
    setCourse((current) => ({ ...current, slug: createCourseSlugDraft(value) }));
  };

  const finalizeSlug = () => {
    setCourse((current) => {
      const slug = normalizeCourseSlug(current.slug, current.title);
      if (!current.slug && slug) setSlugMode('auto');
      return { ...current, slug };
    });
  };

  const regenerateSlug = () => {
    setSlugMode('auto');
    setCourse((current) => ({ ...current, slug: createCourseSlug(current.title) }));
  };

  const applyImport = ({ course: importedCourse, report }) => {
    const nextCourse = { ...emptyCourse, ...importedCourse, status: 'draft' };
    setCourse(nextCourse);
    setSlugMode(report.slugGenerated ? 'auto' : 'manual');
    setErrors(validateCourseForm(nextCourse, { publishing: true }));
    setTab('details');
    const reviewCount = report.reviewRequired.length;
    setFeedback({
      tone: reviewCount ? 'info' : 'success',
      message: reviewCount
        ? `Course imported as a draft. ${report.stats.modules} modules, ${report.stats.blocks} learning blocks, and ${report.stats.questions} questions were added. Review ${reviewCount} flagged field${reviewCount === 1 ? '' : 's'} before publishing.`
        : `Course imported successfully with ${report.stats.modules} modules, ${report.stats.blocks} learning blocks, and ${report.stats.questions} questions.`,
    });
  };

  if (loading) return <LoadingState label="Loading course editor…" />;
  if (loadError) return <ErrorState title="Course could not be opened" message={loadError} onRetry={load} />;
  const tabs = [{ id: 'details', label: 'Course details' }, { id: 'content', label: `Modules (${course.modules.length})` }, { id: 'assessment', label: `Assessment (${course.assessment.questions.length})` }];
  return (
    <div className="course-editor-page">
      <header className="editor-topbar">
        <div><Link className="text-link back-link" to={`${workspaceBase}/courses`}><ArrowLeft />Courses</Link><div className="editor-title-row"><div><p className="eyebrow">{isInstructor ? 'Instructor course' : editing ? 'Edit course' : 'New course'}</p><h1>{course.title || 'Untitled course'}</h1></div><Badge tone={course.status === 'published' ? 'success' : course.status === 'archived' ? 'neutral' : 'warning'}>{course.status}</Badge></div></div>
        <div className="page-actions">
          {!editing && <TrainingButton variant="secondary" icon={<FileJson2 />} onClick={() => setImportOpen(true)}>Import JSON</TrainingButton>}
          <TrainingButton variant="secondary" loading={saving} icon={<Save />} onClick={() => persist()}>Save {course.status === 'draft' ? 'draft' : 'changes'}</TrainingButton>
          {!isInstructor && <TrainingButton loading={publishing} icon={<Send />} onClick={() => persist({ publish: true })}>{course.status === 'published' ? 'Validate & update' : 'Publish course'}</TrainingButton>}
        </div>
      </header>
      {feedback && <FeedbackBanner tone={feedback.tone} onDismiss={() => setFeedback(null)}>{feedback.message}</FeedbackBanner>}
      <TrainingCard className="editor-tabs" aria-label="Course editor sections">{tabs.map((item) => <button key={item.id} type="button" aria-pressed={tab === item.id} onClick={() => setTab(item.id)}>{item.id === 'details' ? <BookOpen /> : item.id === 'content' ? <CheckCircle2 /> : <Send />}{item.label}</button>)}</TrainingCard>
      <div>{tab === 'details' && <CourseMetadataForm course={course} errors={errors} onChange={setCourse} onChooseCover={() => setCoverPickerOpen(true)} onTitleChange={updateTitle} onSlugChange={updateSlug} onSlugBlur={finalizeSlug} onRegenerateSlug={regenerateSlug} slugMode={slugMode} />}{tab === 'content' && <ModuleEditor modules={course.modules} errors={errors} onChange={(modules) => setCourse((current) => ({ ...current, modules }))} />}{tab === 'assessment' && <AssessmentEditor questions={course.assessment.questions} errors={errors} onChange={(questions) => setCourse((current) => ({ ...current, assessment: { ...current.assessment, questions } }))} />}</div>
      <MediaPickerModal open={coverPickerOpen} onClose={() => setCoverPickerOpen(false)} title="Choose course cover" onSelect={(asset) => setCourse((current) => ({ ...current, coverImage: asset.url }))} />
      <CourseImportModal open={importOpen} onClose={() => setImportOpen(false)} onApply={applyImport} />
    </div>
  );
}
