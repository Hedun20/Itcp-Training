import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Award, Check, Clock3, Layers3, PlayCircle } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { coursesApi } from '../../api/courses';
import { learningApi } from '../../api/learning';
import { Badge, ErrorState, LoadingState, TrainingButton, TrainingCard } from '../../branding/components';
import { completionPercentage, courseCoverUrl, courseId } from '../../utils/format';

export function CourseDetailsPage() {
  const { slug } = useParams();
  const [state, setState] = useState({ loading: true, course: null, progress: null, error: '' });
  const load = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: '' }));
    try {
      const course = await coursesApi.get(slug);
      let progress = null;
      try { progress = await learningApi.courseProgress(courseId(course)); } catch (error) { if (error.status !== 404) throw error; }
      setState({ loading: false, course, progress, error: '' });
    } catch (error) { setState({ loading: false, course: null, progress: null, error: error.message }); }
  }, [slug]);
  useEffect(() => { load(); }, [load]);

  if (state.loading) return <LoadingState label="Opening course…" />;
  if (state.error || !state.course) return <ErrorState title="Course unavailable" message={state.error || 'This course could not be found.'} onRetry={load} />;
  const { course, progress } = state;
  const percentage = completionPercentage(progress, course.modules?.length);
  const startIndex = progress?.currentModuleIndex || 0;

  return (
    <div className="page-stack">
      <Link className="text-link back-link" to="/courses"><ArrowLeft size={16} />Course catalog</Link>
      <TrainingCard className="course-hero">
        <div className="course-hero__copy">
          <div className="badge-row"><Badge tone="accent">{course.code}</Badge>{course.category && <Badge>{course.category}</Badge>}</div>
          <h1>{course.title}</h1>
          <p>{course.description || course.shortDescription}</p>
          <div className="course-facts"><span><Clock3 />{course.estimatedDuration || 'Self-paced'}</span><span><Layers3 />{course.modules?.length || 0} modules</span><span><Award />Pass mark {course.passMark}%</span></div>
          {progress && <div className="course-progress course-progress--hero"><span><span>{progress.status === 'completed' ? 'Course complete' : 'Your progress'}</span><strong>{percentage}%</strong></span><progress value={percentage} max="100">{percentage}%</progress></div>}
          <TrainingButton as={Link} to={`/courses/${course.slug || slug}/learn/${startIndex}`} icon={<PlayCircle size={19} />}>{progress?.status === 'in_progress' ? 'Resume course' : progress?.status === 'completed' ? 'Review course' : 'Start course'} <ArrowRight size={17} /></TrainingButton>
        </div>
        <div className="course-hero__visual"><img src={courseCoverUrl(course)} alt={course.coverImage?.altText || ''} /></div>
      </TrainingCard>
      <section className="course-outline"><div className="section-heading"><div><p className="eyebrow">Course outline</p><h2>What you will cover</h2></div></div><ol>{(course.modules || []).map((module, index) => <li key={module._id || module.id || index}><span>{progress?.completedModuleIds?.includes(module._id || module.id) ? <Check /> : index + 1}</span><div><strong>{module.title || module.name}</strong>{module.description && <p>{module.description}</p>}<small>{module.blocks?.length || 0} learning blocks</small></div></li>)}</ol></section>
    </div>
  );
}
