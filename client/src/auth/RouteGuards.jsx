import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { LoadingState } from '../branding/components';
import { useAuth } from './AuthContext';
import { roleHomePath } from '../utils/roles';

export function ProtectedRoute() {
  const { status } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <main className="boot-state"><LoadingState /></main>;
  if (status !== 'authenticated') return <Navigate to="/login" replace state={{ from: location }} />;
  return <Outlet />;
}

export function RoleRoute({ roles }) {
  const { user } = useAuth();
  if (!user || !roles.includes(user.role)) {
    return <Navigate to={roleHomePath(user?.role)} replace />;
  }
  return <Outlet />;
}

export function HomeRoute() {
  const { user } = useAuth();
  return <Navigate to={roleHomePath(user?.role)} replace />;
}

export function AnonymousRoute({ children }) {
  const { status, user } = useAuth();
  if (status === 'loading') return <main className="boot-state"><LoadingState /></main>;
  if (status === 'authenticated') return <Navigate to={roleHomePath(user?.role)} replace />;
  return children;
}
