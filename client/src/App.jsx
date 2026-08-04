import { Navigate, Route, Routes } from 'react-router-dom';
import { AnonymousRoute, HomeRoute, ProtectedRoute, RoleRoute } from './auth/RouteGuards';
import { AdminShell, InstructorShell, LearnerShell } from './branding/layouts';
import { EmailVerificationPage } from './pages/auth/EmailVerificationPage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';
import { LoginPage } from './pages/auth/LoginPage';
import { OAuthCallbackPage } from './pages/auth/OAuthCallbackPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage';
import { AdminCourseListPage } from './pages/admin/AdminCourseListPage';
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage';
import { AdminMediaPage } from './pages/admin/AdminMediaPage';
import { AdminResultsPage } from './pages/admin/AdminResultsPage';
import { AdminUsersPage } from './pages/admin/AdminUsersPage';
import { CourseEditorPage } from './pages/admin/CourseEditorPage';
import { InstructorProgressPage } from './pages/instructor/InstructorProgressPage';
import { AssessmentPage } from './pages/learner/AssessmentPage';
import { AssessmentResultPage } from './pages/learner/AssessmentResultPage';
import { AttemptHistoryPage } from './pages/learner/AttemptHistoryPage';
import { CourseCatalogPage } from './pages/learner/CourseCatalogPage';
import { CourseDetailsPage } from './pages/learner/CourseDetailsPage';
import { CoursePlayerPage } from './pages/learner/CoursePlayerPage';
import { DashboardPage } from './pages/learner/DashboardPage';
import { ProfilePage } from './pages/learner/ProfilePage';
import { ProgressPage } from './pages/learner/ProgressPage';

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<AnonymousRoute><LoginPage /></AnonymousRoute>} />
      <Route path="/register" element={<AnonymousRoute><RegisterPage /></AnonymousRoute>} />
      <Route path="/verify-email" element={<AnonymousRoute><EmailVerificationPage /></AnonymousRoute>} />
      <Route path="/forgot-password" element={<AnonymousRoute><ForgotPasswordPage /></AnonymousRoute>} />
      <Route path="/reset-password" element={<AnonymousRoute><ResetPasswordPage /></AnonymousRoute>} />
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
