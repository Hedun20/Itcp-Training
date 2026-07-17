import { useMemo, useState } from 'react';
import {
  BookOpenCheck,
  CheckCircle2,
  Clock3,
  FolderOpen,
  Search,
  UserRound,
  XCircle,
} from 'lucide-react';
import {
  Badge,
  EmptyState,
  TrainingButton,
  TrainingCard,
  TrainingInput,
  TrainingModal,
} from '../branding/components';
import { formatDateTime } from '../utils/format';

function entityId(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return value.id || value._id || '';
}

function recordUser(record) {
  const source = record.user || (typeof record.userId === 'object' ? record.userId : null) || {};
  const id = entityId(source) || (typeof record.userId === 'string' ? record.userId : '');
  const email = source.email || record.userEmail || '';
  const name = source.name || record.userName || email || 'Unknown learner';
  return { id, email, name, key: id || email || `${name}-${record._id || record.id || 'record'}` };
}

function recordCourse(record) {
  const source = record.course || (typeof record.courseId === 'object' ? record.courseId : null) || {};
  const id = entityId(source) || (typeof record.courseId === 'string' ? record.courseId : '');
  const code = source.code || record.courseCode || '';
  const title = source.title || record.courseTitle || code || 'Untitled course';
  return { id, code, title, key: id || code || title };
}

function timestamp(value) {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function laterDate(current, candidate) {
  return timestamp(candidate) > timestamp(current) ? candidate : current;
}

function progressActivity(progress) {
  return progress.completedAt || progress.lastAccessedAt || progress.updatedAt || progress.startedAt;
}

export function buildLearnerRecords(progress = [], results = []) {
  const learners = new Map();

  const ensureLearner = (user) => {
    if (!learners.has(user.key)) {
      learners.set(user.key, { ...user, coursesByKey: new Map(), lastActivity: null });
    }
    const learner = learners.get(user.key);
    learner.name = user.name || learner.name;
    learner.email = user.email || learner.email;
    learner.id = user.id || learner.id;
    return learner;
  };

  const ensureCourse = (learner, course) => {
    if (!learner.coursesByKey.has(course.key)) {
      learner.coursesByKey.set(course.key, { ...course, progress: null, attempts: [], lastActivity: null });
    }
    const learnerCourse = learner.coursesByKey.get(course.key);
    learnerCourse.id = course.id || learnerCourse.id;
    learnerCourse.code = course.code || learnerCourse.code;
    learnerCourse.title = course.title || learnerCourse.title;
    return learnerCourse;
  };

  progress.forEach((record) => {
    const learner = ensureLearner(recordUser(record));
    const course = ensureCourse(learner, recordCourse(record));
    course.progress = record;
    course.lastActivity = laterDate(course.lastActivity, progressActivity(record));
    learner.lastActivity = laterDate(learner.lastActivity, course.lastActivity);
  });

  results.forEach((attempt) => {
    const learner = ensureLearner(recordUser(attempt));
    const course = ensureCourse(learner, recordCourse(attempt));
    course.attempts.push(attempt);
    course.lastActivity = laterDate(course.lastActivity, attempt.submittedAt || attempt.updatedAt || attempt.createdAt);
    learner.lastActivity = laterDate(learner.lastActivity, course.lastActivity);
  });

  return [...learners.values()]
    .map((learner) => {
      const courses = [...learner.coursesByKey.values()]
        .map((course) => ({
          ...course,
          attempts: course.attempts.sort((left, right) => timestamp(right.submittedAt) - timestamp(left.submittedAt)),
        }))
        .sort((left, right) => `${left.code} ${left.title}`.localeCompare(`${right.code} ${right.title}`));

      return {
        id: learner.id,
        key: learner.key,
        name: learner.name,
        email: learner.email,
        lastActivity: learner.lastActivity,
        courses,
        completedCourses: courses.filter((course) => course.progress?.status === 'completed').length,
        passedCourses: courses.filter((course) => course.attempts.some((attempt) => attempt.passed)).length,
        attemptCount: courses.reduce((total, course) => total + course.attempts.length, 0),
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name));
}

function coursePercentage(course) {
  const value = course.progress?.percentage ?? course.progress?.completionPercentage ?? 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function LearnerCourseRecord({ course }) {
  const progress = course.progress;
  const percentage = coursePercentage(course);
  const latestAttempt = course.attempts[0];
  const bestScore = course.attempts.length
    ? Math.max(...course.attempts.map((attempt) => Math.round(attempt.percentage ?? 0)))
    : progress?.bestScore;

  return (
    <TrainingCard className="learner-course-record">
      <div className="learner-course-record__header">
        <div>
          <div className="badge-row">
            {course.code && <Badge>{course.code}</Badge>}
            {progress && (
              <Badge tone={progress.status === 'completed' ? 'success' : 'accent'}>
                {progress.status?.replace('_', ' ')}
              </Badge>
            )}
          </div>
          <h3>{course.title}</h3>
        </div>
        {latestAttempt && (
          <Badge tone={latestAttempt.passed ? 'success' : 'danger'}>
            {latestAttempt.passed ? <CheckCircle2 /> : <XCircle />}
            {latestAttempt.passed ? 'Passed' : 'Not passed'}
          </Badge>
        )}
      </div>

      {progress && (
        <div className="course-progress">
          <span>
            <span>{progress.completedModuleIds?.length || 0} modules complete</span>
            <strong>{percentage}%</strong>
          </span>
          <progress value={percentage} max="100" />
        </div>
      )}

      <dl className="learner-course-metrics">
        <div><dt>Attempts</dt><dd>{course.attempts.length}</dd></div>
        <div><dt>Best score</dt><dd>{Number.isFinite(bestScore) ? `${bestScore}%` : '—'}</dd></div>
        <div><dt>Last activity</dt><dd>{formatDateTime(course.lastActivity)}</dd></div>
      </dl>

      {course.attempts.length > 0 && (
        <div className="learner-attempt-list" aria-label={`${course.title} assessment attempts`}>
          {course.attempts.slice(0, 5).map((attempt, index) => (
            <div className="learner-attempt-row" key={attempt._id || attempt.id || `${course.key}-${index}`}>
              <span>
                <strong>{Math.round(attempt.percentage ?? 0)}%</strong>
                <small>{formatDateTime(attempt.submittedAt)}</small>
              </span>
              <Badge tone={attempt.passed ? 'success' : 'danger'}>{attempt.passed ? 'Passed' : 'Not passed'}</Badge>
            </div>
          ))}
        </div>
      )}
    </TrainingCard>
  );
}

export function LearnerRecords({ progress = [], results = [], emptyMessage = 'Learner activity will appear here when training begins.' }) {
  const [query, setQuery] = useState('');
  const [selectedKey, setSelectedKey] = useState('');
  const learners = useMemo(() => buildLearnerRecords(progress, results), [progress, results]);
  const visibleLearners = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return learners;
    return learners.filter((learner) => {
      const courseText = learner.courses.map((course) => `${course.code} ${course.title}`).join(' ');
      return `${learner.name} ${learner.email} ${courseText}`.toLowerCase().includes(normalizedQuery);
    });
  }, [learners, query]);
  const selectedLearner = learners.find((learner) => learner.key === selectedKey);

  if (!learners.length) {
    return <EmptyState title="No learner activity yet" message={emptyMessage} />;
  }

  return (
    <>
      <div className="filter-bar">
        <div className="search-field">
          <Search />
          <TrainingInput
            aria-label="Search learner records"
            placeholder="Search learner, email, or course"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <Badge>{visibleLearners.length} learners</Badge>
      </div>

      {visibleLearners.length ? (
        <div className="learner-record-grid">
          {visibleLearners.map((learner) => (
            <TrainingCard className="learner-record-card" key={learner.key}>
              <div className="learner-record-card__identity">
                <span className="avatar learner-record-card__avatar">{learner.name?.charAt(0)?.toUpperCase() || '?'}</span>
                <span>
                  <h2>{learner.name}</h2>
                  <p>{learner.email || 'No email available'}</p>
                </span>
              </div>
              <div className="learner-record-card__stats">
                <span><BookOpenCheck /><strong>{learner.courses.length}</strong><small>courses</small></span>
                <span><CheckCircle2 /><strong>{learner.completedCourses}</strong><small>completed</small></span>
                <span><Clock3 /><strong>{learner.attemptCount}</strong><small>attempts</small></span>
              </div>
              <div className="learner-record-card__footer">
                <span><Clock3 />Last activity {formatDateTime(learner.lastActivity)}</span>
                <TrainingButton
                  variant="secondary"
                  size="small"
                  icon={<FolderOpen />}
                  onClick={() => setSelectedKey(learner.key)}
                >
                  Open learner
                </TrainingButton>
              </div>
            </TrainingCard>
          ))}
        </div>
      ) : (
        <EmptyState title="No learners match" message="Try a different learner, email address, or course." />
      )}

      <TrainingModal
        open={Boolean(selectedLearner)}
        onClose={() => setSelectedKey('')}
        title={selectedLearner?.name || 'Learner record'}
        description={selectedLearner?.email || 'Training history and assessment outcomes'}
        size="large"
      >
        {selectedLearner && (
          <div className="learner-record-detail">
            <div className="learner-record-detail__summary">
              <span className="avatar learner-record-detail__avatar"><UserRound /></span>
              <dl className="learner-summary-metrics">
                <div><dt>Courses</dt><dd>{selectedLearner.courses.length}</dd></div>
                <div><dt>Completed</dt><dd>{selectedLearner.completedCourses}</dd></div>
                <div><dt>Passed</dt><dd>{selectedLearner.passedCourses}</dd></div>
                <div><dt>Attempts</dt><dd>{selectedLearner.attemptCount}</dd></div>
              </dl>
            </div>
            <div className="learner-course-list">
              {selectedLearner.courses.map((course) => <LearnerCourseRecord course={course} key={course.key} />)}
            </div>
          </div>
        )}
      </TrainingModal>
    </>
  );
}
