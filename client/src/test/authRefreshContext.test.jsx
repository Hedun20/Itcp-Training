import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from '../auth/AuthContext';
import { authApi } from '../api/auth';

vi.mock('../api/auth', () => ({
  authApi: {
    currentUser: vi.fn(),
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
  },
}));

function SessionProbe() {
  const { status, user } = useAuth();
  return <p>{status}:{user?.role || 'none'}:{user?.status || 'none'}</p>;
}

describe('refreshed auth sessions', () => {
  beforeEach(() => {
    authApi.currentUser.mockResolvedValue({ id: 'user-1', role: 'learner', status: 'active' });
  });

  it('updates the live user, role, and status from the refresh response event', async () => {
    render(<AuthProvider><SessionProbe /></AuthProvider>);
    expect(await screen.findByText('authenticated:learner:active')).toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new CustomEvent('itcp:session-refreshed', {
        detail: { user: { id: 'user-1', role: 'admin', status: 'disabled' } },
      }));
    });

    expect(screen.getByText('authenticated:admin:disabled')).toBeInTheDocument();
  });
});
