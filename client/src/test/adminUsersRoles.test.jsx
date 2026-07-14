import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AdminUsersPage } from '../pages/admin/AdminUsersPage';

const apiMocks = vi.hoisted(() => ({ users: vi.fn(), updateUser: vi.fn() }));
vi.mock('../api/admin', () => ({ adminApi: { users: apiMocks.users, updateUser: apiMocks.updateUser } }));

describe('admin user role management', () => {
  it('labels instructors distinctly and offers all three managed roles', async () => {
    apiMocks.users.mockResolvedValue([{ id: 'user-1', name: 'ITCP Instructor', email: 'instructor@example.com', role: 'instructor', status: 'active' }]);
    const user = userEvent.setup();
    render(<AdminUsersPage />);
    expect(await screen.findByText('Instructor')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /manage/i }));
    const roleSelect = screen.getByRole('combobox', { name: 'Role' });
    expect(roleSelect).toHaveValue('instructor');
    expect(screen.getByRole('option', { name: 'Learner' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Instructor' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Admin' })).toBeInTheDocument();
  });
});
