import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '../branding/theme/ThemeProvider';
import { OAuthCallbackPage } from '../pages/auth/OAuthCallbackPage';

const mocks = vi.hoisted(() => ({
  refreshUser: vi.fn(),
  acceptAuthResult: vi.fn(),
  completeGoogle: vi.fn(),
}));

vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ refreshUser: mocks.refreshUser, acceptAuthResult: mocks.acceptAuthResult }) }));
vi.mock('../api/auth', () => ({ authApi: { completeGoogle: mocks.completeGoogle } }));

describe('OAuth callback', () => {
  it('bootstraps the refresh cookie on the canonical callback route', async () => {
    const user = { id: 'learner-1', name: 'Learner', role: 'learner' };
    mocks.refreshUser.mockResolvedValue(user);
    render(<ThemeProvider><MemoryRouter initialEntries={['/auth/callback']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Routes><Route path="/auth/callback" element={<OAuthCallbackPage />} /><Route path="/dashboard" element={<div>Learner dashboard</div>} /></Routes></MemoryRouter></ThemeProvider>);
    expect(await screen.findByText('Learner dashboard')).toBeInTheDocument();
    expect(mocks.refreshUser).toHaveBeenCalledOnce();
    expect(mocks.acceptAuthResult).toHaveBeenCalledWith(user);
    expect(mocks.completeGoogle).not.toHaveBeenCalled();
  });
});
