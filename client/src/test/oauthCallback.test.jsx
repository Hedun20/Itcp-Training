import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '../branding/theme/ThemeProvider';
import { OAuthCallbackPage } from '../pages/auth/OAuthCallbackPage';

const mocks = vi.hoisted(() => ({
  refreshUser: vi.fn(),
  acceptAuthResult: vi.fn(),
  completeGoogle: vi.fn(),
  completeGoogleRegistration: vi.fn(),
}));

vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ refreshUser: mocks.refreshUser, acceptAuthResult: mocks.acceptAuthResult }) }));
vi.mock('../api/auth', () => ({ authApi: { completeGoogle: mocks.completeGoogle, completeGoogleRegistration: mocks.completeGoogleRegistration } }));

describe('OAuth callback', () => {
  beforeEach(() => {
    mocks.refreshUser.mockReset();
    mocks.acceptAuthResult.mockReset();
    mocks.completeGoogle.mockReset();
    mocks.completeGoogleRegistration.mockReset();
  });

  it('bootstraps the refresh cookie on the canonical callback route', async () => {
    const user = { id: 'learner-1', name: 'Learner', role: 'learner' };
    mocks.refreshUser.mockResolvedValue(user);
    render(<ThemeProvider><MemoryRouter initialEntries={['/auth/callback']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Routes><Route path="/auth/callback" element={<OAuthCallbackPage />} /><Route path="/dashboard" element={<div>Learner dashboard</div>} /></Routes></MemoryRouter></ThemeProvider>);
    expect(await screen.findByText('Learner dashboard')).toBeInTheDocument();
    expect(mocks.refreshUser).toHaveBeenCalledOnce();
    expect(mocks.acceptAuthResult).toHaveBeenCalledWith(user);
    expect(mocks.completeGoogle).not.toHaveBeenCalled();
    expect(mocks.completeGoogleRegistration).not.toHaveBeenCalled();
  });

  it('lets a first-time Google user choose instructor and sends the code only on completion', async () => {
    const user = userEvent.setup();
    const instructor = { id: 'instructor-1', name: 'Instructor', role: 'instructor' };
    mocks.completeGoogleRegistration.mockResolvedValue({ user: instructor });
    render(<ThemeProvider><MemoryRouter initialEntries={['/auth/google/callback?onboarding=required']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Routes><Route path="/auth/google/callback" element={<OAuthCallbackPage />} /><Route path="/instructor/courses" element={<div>Instructor workspace</div>} /></Routes></MemoryRouter></ThemeProvider>);
    expect(await screen.findByRole('heading', { name: 'Choose your account role' })).toBeInTheDocument();
    expect(mocks.refreshUser).not.toHaveBeenCalled();
    await user.click(screen.getByRole('radio', { name: /instructor/i }));
    await user.type(screen.getByLabelText(/instructor access code/i), '123456');
    await user.click(screen.getByRole('button', { name: /continue as instructor/i }));
    expect(await screen.findByText('Instructor workspace')).toBeInTheDocument();
    expect(mocks.completeGoogleRegistration).toHaveBeenCalledWith({ role: 'instructor', instructorCode: '123456' });
    expect(mocks.acceptAuthResult).toHaveBeenCalledWith(instructor);
  });

  it('does not offer role selection to an existing Google user or change the returned role', async () => {
    const existing = { id: 'learner-2', name: 'Existing learner', role: 'learner' };
    mocks.refreshUser.mockResolvedValue(existing);
    render(<ThemeProvider><MemoryRouter initialEntries={['/auth/google/callback']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Routes><Route path="/auth/google/callback" element={<OAuthCallbackPage />} /><Route path="/dashboard" element={<div>Existing learner dashboard</div>} /></Routes></MemoryRouter></ThemeProvider>);
    expect(await screen.findByText('Existing learner dashboard')).toBeInTheDocument();
    expect(mocks.completeGoogleRegistration).not.toHaveBeenCalled();
    expect(mocks.acceptAuthResult).toHaveBeenCalledWith(existing);
  });
});
