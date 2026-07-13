import { AlertCircle, CheckCircle2, Info } from 'lucide-react';

export function FeedbackBanner({ tone = 'info', title, children, onDismiss }) {
  const Icon = tone === 'success' ? CheckCircle2 : tone === 'danger' ? AlertCircle : Info;
  return (
    <div className={`feedback-banner feedback-banner--${tone}`} role={tone === 'danger' ? 'alert' : 'status'}>
      <Icon aria-hidden="true" size={19} />
      <div>{title && <strong>{title}</strong>}{children && <span>{children}</span>}</div>
      {onDismiss && <button type="button" onClick={onDismiss} aria-label="Dismiss message">×</button>}
    </div>
  );
}
