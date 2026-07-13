import { AlertTriangle, BookOpen, LoaderCircle, RotateCcw } from 'lucide-react';
import { TrainingButton } from './TrainingButton';
import { TrainingCard } from './TrainingCard';

export function LoadingState({ label = 'Loading your training workspace…', compact = false }) {
  return (
    <div className={`state-view ${compact ? 'state-view--compact' : ''}`} role="status" aria-live="polite">
      <LoaderCircle className="spin" aria-hidden="true" />
      <p>{label}</p>
    </div>
  );
}

export function EmptyState({ title = 'Nothing here yet', message, action, icon: Icon = BookOpen }) {
  return (
    <TrainingCard className="state-view state-view--card">
      <span className="state-icon"><Icon aria-hidden="true" /></span>
      <h2>{title}</h2>
      {message && <p>{message}</p>}
      {action}
    </TrainingCard>
  );
}

export function ErrorState({ title = 'We could not load this', message = 'Please try again.', onRetry }) {
  return (
    <TrainingCard className="state-view state-view--card state-view--error" role="alert">
      <span className="state-icon"><AlertTriangle aria-hidden="true" /></span>
      <h2>{title}</h2>
      <p>{message}</p>
      {onRetry && <TrainingButton variant="secondary" icon={<RotateCcw size={17} />} onClick={onRetry}>Try again</TrainingButton>}
    </TrainingCard>
  );
}
