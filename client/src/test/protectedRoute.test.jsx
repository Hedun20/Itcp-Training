import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProtectedRoute } from '../auth/RouteGuards';

const authState = vi.hoisted(() => ({ status: 'anonymous', user: null }));
vi.mock('../auth/AuthContext', () => ({ useAuth: () => authState }));

function LoginProbe() {
  const location = useLocation();
  return <div>Login destination: {location.state?.from?.pathname}</div>;
}

function TestRoutes() {
  return <MemoryRouter initialEntries={['/private/course']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Routes><Route path="/login" element={<LoginProbe />} /><Route element={<ProtectedRoute />}><Route path="/private/course" element={<div>Protected course</div>} /></Route></Routes></MemoryRouter>;
}

describe('ProtectedRoute', () => {
  beforeEach(() => { authState.status = 'anonymous'; authState.user = null; });

  it('redirects anonymous visitors and preserves the intended destination', () => {
    render(<TestRoutes />);
    expect(screen.getByText('Login destination: /private/course')).toBeInTheDocument();
    expect(screen.queryByText('Protected course')).not.toBeInTheDocument();
  });

  it('renders protected content for an authenticated user', () => {
    authState.status = 'authenticated';
    authState.user = { role: 'learner' };
    render(<TestRoutes />);
    expect(screen.getByText('Protected course')).toBeInTheDocument();
  });
});
