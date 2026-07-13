import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../theme/ThemeProvider';

export function ThemeToggle({ compact = false }) {
  const { theme, toggleTheme } = useTheme();
  const isLight = theme === 'light';
  return (
    <button
      className={`theme-toggle ${compact ? 'theme-toggle--compact' : ''}`}
      type="button"
      onClick={toggleTheme}
      aria-label={`Switch to ${isLight ? 'dark' : 'light'} theme`}
      aria-pressed={isLight}
    >
      <span className="theme-toggle__track" aria-hidden="true">
        <Moon size={14} />
        <Sun size={14} />
        <span className="theme-toggle__knob">{isLight ? <Sun size={14} /> : <Moon size={14} />}</span>
      </span>
      {!compact && <span>{isLight ? 'Light' : 'Dark'}</span>}
    </button>
  );
}
