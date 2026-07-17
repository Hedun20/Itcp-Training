import { useMemo, useState } from 'react';
import {
  Award,
  BookOpenCheck,
  CheckCircle2,
  ChevronDown,
  Clock3,
  FolderOpen,
  GraduationCap,
  Mail,
  Search,
  UserRound,
  XCircle,
} from 'lucide-react';
import {
  Badge,
  EmptyState,
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

function coursePercentage(course) {
  const value = course.progress?.percentage ?? course.progress?.completionPercentage ?? 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function learnerTone(learner) {
  if (learner.courses.length > 0 && learner.completedCourses === learner.courses.length) return 'success';
  if (learner.attemptCount > 0) return 'accent';
  return 'neutral';
}

function learnerStatus(learner) {
  if (learner.courses.length > 0 && learner.completedCourses === learner.courses.length) return 'Training complete';
  if (learner.attemptCount > 0) return 'Active learner';
  return 'Training started';
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
      const totalProgress = courses.reduce((total, course) => total + coursePercentage(course), 0);

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
        overallProgress: courses.length ? Math.round(totalProgress / courses.length) : 0,
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name));
}

function LearnerCourseRecord({ course }) {
  const progress = course.progress;
  const percentage = coursePercentage(course);
  const latestAttempt = course.attempts[0];
  const bestScore = course.attempts.length
    ? Math.max(...course.attempts.map((attempt) => Math.round(attempt.percentage ?? 0)))
    : progress?.bestScore;

  return (
    <details className="learner-course-record">
      <summary>
        <span className="learner-course-record__summary-icon"><BookOpenCheck /></span>
        <span className="learner-course-record__summary-copy">
          <span className="badge-row">
            {course.code && <Badge>{course.code}</Badge>}
            {progress && <Badge tone={progress.status === 'completed' ? 'success' : 'accent'}>{progress.status?.replace('_', ' ')}</Badge>}
          </span>
          <strong>{course.title}</strong>
          <small>{percentage}% complete · {course.attempts.length} assessment {course.attempts.length === 1 ? 'attempt' : 'attempts'}</small>
        </span>
        <span className="learner-course-record__summary-score">
          {latestAttempt ? (
            <Badge tone={latestAttempt.passed ? 'success' : 'danger'}>
              {latestAttempt.passed ? <CheckCircle2 /> : <XCircle />}
              {Math.round(latestAttempt.percentage ?? 0)}%
            </Badge>
          ) : <Badge>Not assessed</Badge>}
          <ChevronDown className="learner-course-record__chevron" />
        </span>
      </summary>

      <div className="learner-course-record__body">
        <div className="course-progress">
          <span>
            <span>{progress?.completedModuleIds?.length || 0} modules complete</span>
            <strong>{percentage}%</strong>
          </span>
          <progress value={percentage} max="100" />
        </div>

        <dl className="learner-course-metrics">
          <div><dt>Attempts</dt><dd>{course.attempts.length}</dd></div>
          <div><dt>Best score</dt><dd>{Number.isFinite(bestScore) ? `${bestScore}%` : '—'}</dd></div>
          <div><dt>Last activity</dt><dd>{formatDateTime(course.lastActivity)}</dd></div>
        </dl>

        {course.attempts.length > 0 ? (
          <div className="learner-attempt-list" aria-label={`${course.title} assessment attempts`}>
            {course.attempts.slice(0, 5).map((attempt, index) => (
              <div className="learner-attempt-row" key={attempt._id || attempt.id || `${course.key}-${index}`}>
                <span className="learner-attempt-row__index">{String(index + 1).padStart(2, '0')}</span>
                <span>
                  <strong>{Math.round(attempt.percentage ?? 0)}%</strong>
                  <small>{formatDateTime(attempt.submittedAt)}</small>
                </span>
                <Badge tone={attempt.passed ? 'success' : 'danger'}>{attempt.passed ? 'Passed' : 'Not passed'}</Badge>
              </div>
            ))}
          </div>
        ) : (
          <p className="learner-course-record__empty">No assessment attempt has been submitted for this course.</p>
        )}
      </div>
    </details>
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
      <div className="learner-record-toolbar">
        <div>
          <span className="learner-record-toolbar__eyebrow">Personnel records</span>
          <strong>{learners.length} learner {learners.length === 1 ? 'folder' : 'folders'}</strong>
          <small>Open a folder to review progress, assessment history, and recent activity.</small>
        </div>
        <div className="search-field learner-record-search">
          <Search />
          <TrainingInput
            aria-label="Search learner records"
            placeholder="Search learner, email, or course"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
      </div>

      {visibleLearners.length ? (
        <div className="learner-record-grid">
          {visibleLearners.map((learner) => (
            <button
              className="learner-folder-card"
              key={learner.key}
              type="button"
              onClick={() => setSelectedKey(learner.key)}
              aria-label={`Open training record for ${learner.name}`}
            >
              <span className="learner-folder-card__tab"><FolderOpen /></span>
              <span className="learner-folder-card__header">
                <span className="avatar learner-folder-card__avatar">{learner.name?.charAt(0)?.toUpperCase() || '?'}</span>
                <span className="learner-folder-card__identity">
                  <strong>{learner.name}</strong>
                  <span><Mail />{learner.email || 'No email available'}</span>
                </span>
                <Badge tone={learnerTone(learner)}>{learnerStatus(learner)}</Badge>
              </span>

              <span className="learner-folder-card__progress">
                <span><span>Overall progress</span><strong>{learner.overallProgress}%</strong></span>
                <progress value={learner.overallProgress} max="100" />
              </span>

              <span className="learner-folder-card__metrics">
                <span><GraduationCap /><strong>{learner.courses.length}</strong><small>Courses</small></span>
                <span><CheckCircle2 /><strong>{learner.completedCourses}</strong><small>Completed</small></span>
                <span><Award /><strong>{learner.passedCourses}</strong><small>Passed</small></span>
              </span>

              <span className="learner-folder-card__footer">
                <span><Clock3 />{formatDateTime(learner.lastActivity)}</span>
                <span className="learner-folder-card__open">Open record <FolderOpen /></span>
              </span>
            </button>
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
            <aside className="learner-record-profile">
              <span className="avatar learner-record-detail__avatar"><UserRound /></span>
              <div>
                <span className="learner-record-profile__eyebrow">Training record</span>
                <h3>{selectedLearner.name}</h3>
                <p>{selectedLearner.email || 'No email available'}</p>
              </div>
              <Badge tone={learnerTone(selectedLearner)}>{learnerStatus(selectedLearner)}</Badge>
              <div className="learner-record-profile__progress">
                <span><span>Overall progress</span><strong>{selectedLearner.overallProgress}%</strong></span>
                <progress value={selectedLearner.overallProgress} max="100" />
              </div>
              <dl className="learner-summary-metrics">
                <div><dt>Courses</dt><dd>{selectedLearner.courses.length}</dd></div>
                <div><dt>Completed</dt><dd>{selectedLearner.completedCourses}</dd></div>
                <div><dt>Passed</dt><dd>{selectedLearner.passedCourses}</dd></div>
                <div><dt>Attempts</dt><dd>{selectedLearner.attemptCount}</dd></div>
              </dl>
              <span className="learner-record-profile__activity"><Clock3 />Last activity {formatDateTime(selectedLearner.lastActivity)}</span>
            </aside>

            <section className="learner-record-courses">
              <div className="learner-record-courses__heading">
                <div>
                  <span>Course history</span>
                  <h3>Progress and assessments</h3>
                </div>
                <Badge>{selectedLearner.courses.length} courses</Badge>
              </div>
              <div className="learner-course-list">
                {selectedLearner.courses.map((course) => <LearnerCourseRecord course={course} key={course.key} />)}
              </div>
            </section>
          </div>
        )}
      </TrainingModal>
    </>
  );
}
