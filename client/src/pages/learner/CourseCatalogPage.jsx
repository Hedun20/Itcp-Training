import { useCallback, useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { coursesApi } from '../../api/courses';
import { learningApi } from '../../api/learning';
import { EmptyState, ErrorState, LoadingState, TrainingInput, TrainingSelect } from '../../branding/components';
import { CourseCard } from '../../components/CourseCard';
import { PageHeader } from '../../components/PageHeader';
import { courseId } from '../../utils/format';

export function CourseCatalogPage() {
  const [data, setData] = useState({ loading: true, courses: [], progress: [], error: '' });
  const [filters, setFilters] = useState({ query: '', category: 'all' });
  const load = useCallback(async () => {
    setData((current) => ({ ...current, loading: true, error: '' }));
    try {
      const [courses, progress] = await Promise.all([coursesApi.list(), learningApi.myProgress()]);
      setData({ loading: false, courses, progress, error: '' });
    } catch (error) { setData((current) => ({ ...current, loading: false, error: error.message })); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const categories = useMemo(() => [...new Set(data.courses.map((course) => course.category).filter(Boolean))].sort(), [data.courses]);
  const progressMap = useMemo(() => new Map(data.progress.map((item) => [String(item.courseId?._id || item.courseId || item.course?._id), item])), [data.progress]);
  const visible = useMemo(() => data.courses.filter((course) => {
    const haystack = `${course.code} ${course.title} ${course.shortDescription || course.description} ${(course.tags || []).join(' ')}`.toLowerCase();
    return haystack.includes(filters.query.trim().toLowerCase()) && (filters.category === 'all' || course.category === filters.category);
  }), [data.courses, filters]);

  return (
    <div className="page-stack">
      <PageHeader eyebrow="Published training" title="Course catalog" description="Practical learning paths designed for responsible, confident work." />
      <div className="filter-bar">
        <div className="search-field"><Search aria-hidden="true" size={18} /><TrainingInput aria-label="Search courses" placeholder="Search by course, code, or topic" value={filters.query} onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))} /></div>
        <TrainingSelect aria-label="Filter by category" value={filters.category} onChange={(event) => setFilters((current) => ({ ...current, category: event.target.value }))}><option value="all">All categories</option>{categories.map((category) => <option key={category} value={category}>{category}</option>)}</TrainingSelect>
      </div>
      {data.loading ? <LoadingState label="Loading available courses…" /> : data.error ? <ErrorState message={data.error} onRetry={load} /> : visible.length ? <><p className="result-count" aria-live="polite">{visible.length} course{visible.length === 1 ? '' : 's'} available</p><div className="course-grid">{visible.map((course) => <CourseCard key={courseId(course)} course={course} progress={progressMap.get(String(courseId(course)))} />)}</div></> : <EmptyState title="No courses match" message="Try a different search term or category." />}
    </div>
  );
}
