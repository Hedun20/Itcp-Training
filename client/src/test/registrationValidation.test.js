import { describe, expect, it } from 'vitest';
import { validateRegistrationForm } from '../utils/authValidation';

describe('registration validation', () => {
  it('reports every required field beside the field', () => {
    expect(validateRegistrationForm({})).toEqual({
      role: 'Choose learner or instructor.',
      name: 'Full name is required.',
      email: 'Work email is required.',
      password: 'Password is required.',
      confirmPassword: 'Confirm your password.',
      authorization: 'Confirm that you are authorised to create this account.',
    });
  });

  it.each([
    ['short password', 'abc123', /at least 10/i],
    ['letters only', 'abcdefghij', /letter and one number/i],
    ['numbers only', '1234567890', /letter and one number/i],
  ])('rejects %s', (_case, password, expected) => {
    const errors = validateRegistrationForm({
      name: 'ITCP Learner',
      role: 'learner',
      email: 'learner@example.com',
      password,
      confirmPassword: password,
      authorization: true,
    });
    expect(errors.password).toMatch(expected);
  });

  it('accepts matching credentials and authorization', () => {
    expect(validateRegistrationForm({
      name: 'ITCP Learner',
      role: 'learner',
      email: 'learner@example.com',
      password: 'training2026',
      confirmPassword: 'training2026',
      authorization: true,
    })).toEqual({});
  });

  it('requires exactly six digits only when instructor is selected', () => {
    const base = {
      name: 'ITCP Instructor',
      email: 'instructor@example.com',
      password: 'training2026',
      confirmPassword: 'training2026',
      authorization: true,
    };
    expect(validateRegistrationForm({ ...base, role: 'learner' })).toEqual({});
    expect(validateRegistrationForm({ ...base, role: 'instructor', instructorCode: '12345' })).toMatchObject({ instructorCode: expect.stringMatching(/six-digit/i) });
    expect(validateRegistrationForm({ ...base, role: 'instructor', instructorCode: '123456' })).toEqual({});
  });

  it('does not accept admin as a public registration role', () => {
    expect(validateRegistrationForm({
      role: 'admin',
      name: 'Public Admin',
      email: 'admin@example.com',
      password: 'training2026',
      confirmPassword: 'training2026',
      authorization: true,
    })).toMatchObject({ role: expect.any(String) });
  });
});
