import { forwardRef } from 'react';
import { LoaderCircle } from 'lucide-react';

export const TrainingButton = forwardRef(function TrainingButton({
  as: Component = 'button',
  variant = 'primary',
  size = 'medium',
  loading = false,
  icon,
  iconOnly = false,
  className = '',
  children,
  disabled,
  type,
  ...props
}, ref) {
  const isButton = Component === 'button';
  return (
    <Component
      ref={ref}
      className={`training-button training-button--${variant} training-button--${size} ${iconOnly ? 'training-button--icon' : ''} ${className}`.trim()}
      disabled={isButton ? disabled || loading : undefined}
      aria-disabled={!isButton && (disabled || loading) ? 'true' : undefined}
      aria-busy={loading || undefined}
      type={isButton ? type || 'button' : undefined}
      {...props}
    >
      {loading ? <LoaderCircle className="spin" aria-hidden="true" size={18} /> : icon}
      {!iconOnly && <span>{loading ? 'Working…' : children}</span>}
      {iconOnly && <span className="sr-only">{children}</span>}
    </Component>
  );
});
