import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RoleRoute } from '../auth/RouteGuards';
import { InstructorShell } from '../branding/layouts/InstructorShell';
import { ThemeProvider } from '../branding/theme/ThemeProvider';

const authState = vi.hoisted(() => ({ user: null, logout: vi.fn() }));
vi.mock('../auth/AuthContext', () => ({ useAuth: () => authState }));

function GuardProbe() {
  return (
    <MemoryRouter initialEntries={['/instructor/courses']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/dashboard" element={<div>Learner home</div>} />
        <Route path="/admin" element={<div>Admin home</div>} />
        <Route path="/instructor" element={<div>Instructor fallback</div>} />
        <Route element={<RoleRoute roles={['instructor']} />}><Route path="/instructor/courses" element={<div>Instructor courses</div>} /></Route>
      </Routes>
    </MemoryRouter>
  );
}

describe('instructor routes and navigation', () => {
  beforeEach(() => { authState.user = { id: 'instructor-1', name: 'Course Owner', email: 'owner@example.com', role: 'instructor' }; });

  it('allows instructors and redirects learners away from instructor management', () => {
    const view = render(<GuardProbe />);
    expect(screen.getByText('Instructor courses')).toBeInTheDocument();
    view.unmount();
    authState.user = { id: 'learner-1', role: 'learner' };
    render(<GuardProbe />);
    expect(screen.getByText('Learner home')).toBeInTheDocument();
    expect(screen.queryByText('Instructor courses')).not.toBeInTheDocument();
  });

  it('shows only instructor-safe management destinations', () => {
    render(<ThemeProvider><MemoryRouter initialEntries={['/instructor/courses']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Routes><Route path="/instructor" element={<InstructorShell />}><Route path="courses" element={<div>Owned course list</div>} /></Route></Routes></MemoryRouter></ThemeProvider>);
    expect(screen.getByRole('navigation', { name: 'Instructor navigation' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /my courses/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /course media/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /learner progress/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /users/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /audit/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /system/i })).not.toBeInTheDocument();
  });
});
