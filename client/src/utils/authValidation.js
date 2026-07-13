const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function passwordValidationMessage(password) {
  if (!password) return 'Password is required.';
  if (password.length < 10) return 'Password must contain at least 10 characters.';
  if (password.length > 128) return 'Password must contain at most 128 characters.';
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return 'Password must contain at least one letter and one number.';
  return '';
}

export function validateRegistrationForm(form) {
  const errors = {};
  const name = form.name?.trim() || '';
  const email = form.email?.trim() || '';

  if (!name) errors.name = 'Full name is required.';
  else if (name.length < 2) errors.name = 'Full name must contain at least 2 characters.';
  else if (name.length > 120) errors.name = 'Full name must contain at most 120 characters.';

  if (!email) errors.email = 'Work email is required.';
  else if (email.length > 254 || !EMAIL_PATTERN.test(email)) errors.email = 'Enter a valid email address.';

  const passwordError = passwordValidationMessage(form.password);
  if (passwordError) errors.password = passwordError;
  if (!form.confirmPassword) errors.confirmPassword = 'Confirm your password.';
  else if (form.password !== form.confirmPassword) errors.confirmPassword = 'Passwords do not match.';
  if (!form.authorization) errors.authorization = 'Confirm that you are authorised to create this account.';

  return errors;
}
