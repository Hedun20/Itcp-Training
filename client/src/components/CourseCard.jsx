import { ArrowRight, Clock3, Layers3 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge, TrainingCard } from '../branding/components';
import { courseCoverUrl } from '../utils/format';

export function CourseCard({ course, progress }) {
  const moduleCount = course.moduleCount ?? course.modules?.length ?? 0;
  const percentage = progress?.percentage ?? (moduleCount && progress?.completedModuleIds
    ? Math.round((progress.completedModuleIds.length / moduleCount) * 100)
    : 0);
  return (
    <TrainingCard as="article" interactive className="course-card">
      <Link className="course-card__cover" to={`/courses/${course.slug || course._id}`} aria-label={`View ${course.title}`}>
        <img src={courseCoverUrl(course)} alt={course.coverImage?.altText || ''} />
        <Badge tone={progress?.status === 'completed' ? 'success' : 'accent'}>{course.code}</Badge>
      </Link>
      <div className="course-card__body">
        <div className="course-card__meta"><span><Clock3 size={15} />{course.estimatedDuration || course.duration || 'Self-paced'}</span><span><Layers3 size={15} />{moduleCount} modules</span></div>
        <h2><Link to={`/courses/${course.slug || course._id}`}>{course.title}</Link></h2>
        <p>{course.shortDescription || course.description}</p>
        {progress && <div className="course-progress"><span><span>{progress.status === 'completed' ? 'Completed' : progress.status === 'in_progress' ? 'In progress' : 'Not started'}</span><strong>{percentage}%</strong></span><progress max="100" value={percentage}>{percentage}%</progress></div>}
        <Link className="text-link" to={`/courses/${course.slug || course._id}`}>{progress?.status === 'in_progress' ? 'Continue course' : 'View course'}<ArrowRight size={16} /></Link>
      </div>
    </TrainingCard>
  );
}
