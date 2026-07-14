import { Navigate, Route, Routes } from 'react-router-dom';
import { AnonymousRoute, HomeRoute, ProtectedRoute, RoleRoute } from './auth/RouteGuards';
import { AdminShell, InstructorShell, LearnerShell } from './branding/layouts';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';
import { OAuthCallbackPage } from './pages/auth/OAuthCallbackPage';
import { DashboardPage } from './pages/learner/DashboardPage';
import { CourseCatalogPage } from './pages/learner/CourseCatalogPage';
import { CourseDetailsPage } from './pages/learner/CourseDetailsPage';
import { CoursePlayerPage } from './pages/learner/CoursePlayerPage';
import { AssessmentPage } from './pages/learner/AssessmentPage';
import { AssessmentResultPage } from './pages/learner/AssessmentResultPage';
import { ProgressPage } from './pages/learner/ProgressPage';
import { AttemptHistoryPage } from './pages/learner/AttemptHistoryPage';
import { ProfilePage } from './pages/learner/ProfilePage';
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage';
import { AdminCourseListPage } from './pages/admin/AdminCourseListPage';
import { CourseEditorPage } from './pages/admin/CourseEditorPage';
import { AdminMediaPage } from './pages/admin/AdminMediaPage';
import { AdminUsersPage } from './pages/admin/AdminUsersPage';
import { AdminResultsPage } from './pages/admin/AdminResultsPage';
import { InstructorProgressPage } from './pages/instructor/InstructorProgressPage';

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<AnonymousRoute><LoginPage /></AnonymousRoute>} />
      <Route path="/register" element={<AnonymousRoute><RegisterPage /></AnonymousRoute>} />
      <Route path="/forgot-password" element={<AnonymousRoute><ForgotPasswordPage /></AnonymousRoute>} />
      <Route path="/auth/google/callback" element={<OAuthCallbackPage />} />
      <Route path="/auth/callback" element={<OAuthCallbackPage />} />
      <Route element={<ProtectedRoute />}>
        <Route index element={<HomeRoute />} />
        <Route element={<RoleRoute roles={['learner']} />}>
          <Route element={<LearnerShell />}>
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="courses" element={<CourseCatalogPage />} />
            <Route path="courses/:slug" element={<CourseDetailsPage />} />
            <Route path="courses/:slug/learn/:moduleIndex?" element={<CoursePlayerPage />} />
            <Route path="courses/:slug/assessment" element={<AssessmentPage />} />
            <Route path="courses/:slug/results/:attemptId" element={<AssessmentResultPage />} />
            <Route path="progress" element={<ProgressPage />} />
            <Route path="history" element={<AttemptHistoryPage />} />
            <Route path="profile" element={<ProfilePage />} />
          </Route>
        </Route>
        <Route element={<RoleRoute roles={['instructor']} />}>
          <Route path="instructor" element={<InstructorShell />}>
            <Route index element={<Navigate to="courses" replace />} />
            <Route path="courses" element={<AdminCourseListPage />} />
            <Route path="courses/new" element={<CourseEditorPage />} />
            <Route path="courses/:courseId/edit" element={<CourseEditorPage />} />
            <Route path="media" element={<AdminMediaPage />} />
            <Route path="progress" element={<InstructorProgressPage />} />
          </Route>
        </Route>
        <Route element={<RoleRoute roles={['admin']} />}>
          <Route path="admin" element={<AdminShell />}>
            <Route index element={<AdminDashboardPage />} />
            <Route path="courses" element={<AdminCourseListPage />} />
            <Route path="courses/new" element={<CourseEditorPage />} />
            <Route path="courses/:courseId/edit" element={<CourseEditorPage />} />
            <Route path="media" element={<AdminMediaPage />} />
            <Route path="users" element={<AdminUsersPage />} />
            <Route path="results" element={<AdminResultsPage />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
