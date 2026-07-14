export function roleHomePath(role) {
  if (role === 'admin') return '/admin';
  if (role === 'instructor') return '/instructor/courses';
  return '/dashboard';
}

export function roleLabel(role) {
  if (role === 'admin') return 'Admin';
  if (role === 'instructor') return 'Instructor';
  return 'Learner';
}
