import { forwardRef, useId } from 'react';
import { ChevronDown } from 'lucide-react';

export const TrainingSelect = forwardRef(function TrainingSelect(
  { id, label, error, hint, className = '', children, ...props },
  ref,
) {
  const generatedId = useId();
  const selectId = id || generatedId;
  const messageId = `${selectId}-message`;
  const describedBy = error || hint ? messageId : undefined;

  return (
    <div className={`training-field training-select-field ${error ? 'training-field--error' : ''} ${className}`.trim()}>
      {label && (
        <label htmlFor={selectId}>
          {label}
          {props.required && <span aria-hidden="true"> *</span>}
        </label>
      )}
      <span className="select-wrap">
        <select
          ref={ref}
          id={selectId}
          className="training-input training-select"
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          {...props}
        >
          {children}
        </select>
        <span className="training-select__indicator" aria-hidden="true">
          <ChevronDown size={17} />
        </span>
      </span>
      {(error || hint) && (
        <span id={messageId} className="field-message" role={error ? 'alert' : undefined}>
          {error || hint}
        </span>
      )}
    </div>
  );
});
