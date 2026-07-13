import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, ChevronLeft, List, Trophy } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { coursesApi } from '../../api/courses';
import { learningApi } from '../../api/learning';
import { Badge, ErrorState, LoadingState, TrainingButton, TrainingCard } from '../../branding/components';
import { CourseContent } from '../../components/CourseContent';
import { FeedbackBanner } from '../../components/FeedbackBanner';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { courseId, moduleId } from '../../utils/format';
import { trapTabKey } from '../../utils/focus';

export function CoursePlayerPage() {
  const { slug, moduleIndex } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState({ loading: true, course: null, progress: null, error: '' });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [outlineOpen, setOutlineOpen] = useState(false);
  const isMobile = useMediaQuery('(max-width: 860px)');
  const outlineToggleRef = useRef(null);
  const outlineRef = useRef(null);
  const outlineClosed = isMobile && !outlineOpen;
  const currentIndex = Math.max(0, Number.parseInt(moduleIndex || '0', 10) || 0);

  const load = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: '' }));
    try {
      const course = await coursesApi.get(slug);
      let progress = null;
      try { progress = await learningApi.courseProgress(courseId(course)); } catch (error) { if (error.status !== 404) throw error; }
      setState({ loading: false, course, progress, error: '' });
      if (course.modules?.length) {
        const resumeIndex = Math.min(currentIndex, course.modules.length - 1);
        learningApi.saveProgress(courseId(course), { currentModuleIndex: resumeIndex, completedModuleIds: progress?.completedModuleIds || [] })
          .then((updated) => setState((current) => ({ ...current, progress: updated })))
          .catch((error) => setSaveError(error.message));
      }
    } catch (error) { setState((current) => ({ ...current, loading: false, error: error.message })); }
  }, [currentIndex, slug]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!isMobile || !outlineOpen) return undefined;
    const previouslyFocused = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    const frame = window.requestAnimationFrame(() => outlineRef.current?.querySelector('a, button')?.focus());
    const handleDrawerKeys = (event) => {
      if (event.key === 'Escape') setOutlineOpen(false);
      else trapTabKey(event, outlineRef.current);
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleDrawerKeys);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('keydown', handleDrawerKeys);
      document.body.style.overflow = previousOverflow;
      if (previouslyFocused?.isConnected) window.requestAnimationFrame(() => previouslyFocused.focus());
    };
  }, [isMobile, outlineOpen]);

  const modules = useMemo(() => state.course?.modules || [], [state.course]);
  const safeIndex = Math.min(currentIndex, Math.max(modules.length - 1, 0));
  const currentModule = modules[safeIndex];
  const completed = state.progress?.completedModuleIds || [];
  const courseKey = state.course?.slug || slug;

  const goTo = async (nextIndex, markComplete = false) => {
    if (!state.course || saving) return;
    setSaving(true);
    setSaveError('');
    const currentId = moduleId(currentModule, safeIndex);
    const nextCompleted = markComplete && !completed.some((id) => String(id) === String(currentId)) ? [...completed, currentId] : completed;
    try {
      const progress = await learningApi.saveProgress(courseId(state.course), {
        currentModuleIndex: nextIndex,
        completedModuleIds: nextCompleted,
      });
      setState((current) => ({ ...current, progress }));
      navigate(`/courses/${courseKey}/learn/${nextIndex}`);
      setOutlineOpen(false);
    } catch (error) { setSaveError(error.message || 'Progress could not be saved.'); }
    finally { setSaving(false); }
  };

  const finishAndAssess = async () => {
    if (!state.course || saving) return;
    setSaving(true);
    setSaveError('');
    const currentId = moduleId(currentModule, safeIndex);
    const nextCompleted = completed.some((id) => String(id) === String(currentId)) ? completed : [...completed, currentId];
    try {
      const progress = await learningApi.saveProgress(courseId(state.course), { currentModuleIndex: safeIndex, completedModuleIds: nextCompleted });
      setState((current) => ({ ...current, progress }));
      navigate(`/courses/${courseKey}/assessment`);
    } catch (error) { setSaveError(error.message || 'Progress could not be saved.'); }
    finally { setSaving(false); }
  };

  if (state.loading) return <LoadingState label="Preparing your module…" />;
  if (state.error || !state.course) return <ErrorState message={state.error || 'Course unavailable.'} onRetry={load} />;
  if (!currentModule) return <ErrorState title="No modules available" message="This course does not contain learning modules yet." />;

  const completion = modules.length ? Math.round((completed.length / modules.length) * 100) : 0;
  const isLast = safeIndex === modules.length - 1;
  return (
    <div className="player-layout">
      <button ref={outlineToggleRef} type="button" className="player-outline-toggle" onClick={() => setOutlineOpen((value) => !value)} aria-expanded={outlineOpen} aria-controls="course-outline"><List />Course outline</button>
      <aside ref={outlineRef} id="course-outline" className={`player-outline ${outlineOpen ? 'player-outline--open' : ''}`} aria-label="Course modules" aria-hidden={outlineClosed ? 'true' : undefined} inert={outlineClosed ? '' : undefined}>
        <Link className="text-link" to={`/courses/${courseKey}`}><ArrowLeft size={16} />Course overview</Link>
        <div className="player-course-title"><Badge tone="accent">{state.course.code}</Badge><h2>{state.course.title}</h2></div>
        <div className="course-progress"><span><span>Course progress</span><strong>{completion}%</strong></span><progress max="100" value={completion}>{completion}%</progress></div>
        <ol>{modules.map((item, index) => { const done = completed.some((id) => String(id) === String(moduleId(item, index))); return <li key={moduleId(item, index)}><button className={index === safeIndex ? 'active' : ''} onClick={() => goTo(index)}><span>{done ? <Check /> : index + 1}</span><strong>{item.title || item.name}</strong></button></li>; })}</ol>
      </aside>
      {outlineOpen && isMobile && <button type="button" className="sidebar-scrim player-outline-scrim" aria-label="Close course outline" onClick={() => setOutlineOpen(false)} />}
      <article className="player-stage">
        <header className="player-stage__header"><div><p className="eyebrow">Module {safeIndex + 1} of {modules.length}</p><h1>{currentModule.title || currentModule.name}</h1>{currentModule.description && <p>{currentModule.description}</p>}</div></header>
        {saveError && <FeedbackBanner tone="danger">{saveError}</FeedbackBanner>}
        <TrainingCard className="player-content-card"><CourseContent blocks={currentModule.blocks || currentModule.contentBlocks || []} /></TrainingCard>
        <footer className="player-controls">
          <TrainingButton variant="secondary" icon={<ChevronLeft size={18} />} disabled={safeIndex === 0 || saving} onClick={() => goTo(safeIndex - 1)}>Previous</TrainingButton>
          {isLast ? <TrainingButton loading={saving} icon={<Trophy size={18} />} onClick={finishAndAssess}>Complete & take assessment</TrainingButton> : <TrainingButton loading={saving} onClick={() => goTo(safeIndex + 1, true)}>Complete & continue <ArrowRight size={18} /></TrainingButton>}
        </footer>
      </article>
    </div>
  );
}
