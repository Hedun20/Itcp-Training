import { BookOpen, Presentation } from 'lucide-react';

const roles = [
  { value: 'learner', label: 'Learner', description: 'Take courses and track your progress.', icon: BookOpen },
  { value: 'instructor', label: 'Instructor', description: 'Create and manage your own courses.', icon: Presentation },
];

export function AccountRoleSelector({ value, onChange, error, name = 'role', idPrefix = 'registration' }) {
  const errorId = `${idPrefix}-role-error`;
  return (
    <fieldset className="role-selector" aria-describedby={error ? errorId : undefined}>
      <legend>Account role</legend>
      <div className="role-selector__options">
        {roles.map(({ value: role, label, description, icon: Icon }) => (
          <label key={role} className={value === role ? 'selected' : ''}>
            <input type="radio" name={name} value={role} checked={value === role} onChange={onChange} />
            <Icon aria-hidden="true" />
            <span><strong>{label}</strong><small>{description}</small></span>
          </label>
        ))}
      </div>
      {error && <span id={errorId} className="field-message inline-error" role="alert">{error}</span>}
    </fieldset>
  );
}
