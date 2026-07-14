import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RegisterPage } from '../pages/auth/RegisterPage';

const mocks = vi.hoisted(() => ({ register: vi.fn() }));
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ register: mocks.register }) }));
vi.mock('../components/GoogleSignInButton', () => ({ GoogleSignInButton: () => <div>Google sign-in</div> }));
vi.mock('../branding/layouts', () => ({ AuthShell: ({ title, children }) => <main><h1>{title}</h1>{children}</main> }));

function renderRegistration() {
  return render(
    <MemoryRouter initialEntries={['/register']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/dashboard" element={<div>Learner destination</div>} />
        <Route path="/instructor/courses" element={<div>Instructor destination</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

async function fillCommonFields(user) {
  await user.type(screen.getByLabelText(/full name/i), 'Taylor Trainer');
  await user.type(screen.getByLabelText(/work email/i), 'Taylor@Example.com');
  await user.type(screen.getByLabelText(/^password/i), 'training2026');
  await user.type(screen.getByLabelText(/confirm password/i), 'training2026');
  await user.click(screen.getByRole('checkbox'));
}

describe('email registration roles', () => {
  beforeEach(() => { mocks.register.mockReset(); });

  it('registers a learner without sending an instructor code', async () => {
    mocks.register.mockResolvedValue({ id: 'learner-1', role: 'learner' });
    const user = userEvent.setup();
    renderRegistration();
    await fillCommonFields(user);
    await user.click(screen.getByRole('button', { name: /create learner account/i }));
    await screen.findByText('Learner destination');
    expect(mocks.register).toHaveBeenCalledWith({
      name: 'Taylor Trainer',
      email: 'Taylor@Example.com',
      password: 'training2026',
      role: 'learner',
    });
  });

  it('shows the code only for instructors and submits exactly six digits', async () => {
    mocks.register.mockResolvedValue({ id: 'instructor-1', role: 'instructor' });
    const user = userEvent.setup();
    renderRegistration();
    expect(screen.queryByLabelText(/instructor access code/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: /instructor/i }));
    await fillCommonFields(user);
    await user.type(screen.getByLabelText(/instructor access code/i), '12x34567');
    await user.click(screen.getByRole('button', { name: /create instructor account/i }));
    await screen.findByText('Instructor destination');
    expect(mocks.register).toHaveBeenCalledWith(expect.objectContaining({
      role: 'instructor',
      instructorCode: '123456',
    }));
  });

  it('suppresses duplicate submissions while the first request is pending', async () => {
    mocks.register.mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();
    renderRegistration();
    await fillCommonFields(user);
    const form = screen.getByRole('button', { name: /create learner account/i }).closest('form');
    fireEvent.submit(form);
    fireEvent.submit(form);
    await waitFor(() => expect(mocks.register).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('button', { name: /working/i })).toBeDisabled();
  });
});
