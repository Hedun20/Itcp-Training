import { describe, expect, it } from 'vitest';
import { validateRegistrationForm } from '../utils/authValidation';

describe('registration validation', () => {
  it('reports every required field beside the field', () => {
    expect(validateRegistrationForm({})).toEqual({
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
      email: 'learner@example.com',
      password: 'training2026',
      confirmPassword: 'training2026',
      authorization: true,
    })).toEqual({});
  });
});
