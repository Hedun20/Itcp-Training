import { forwardRef, useId } from 'react';

export const TrainingInput = forwardRef(function TrainingInput(
  { id, label, error, hint, multiline = false, className = '', inputClassName = '', ...props },
  ref,
) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const messageId = `${inputId}-message`;
  const Component = multiline ? 'textarea' : 'input';

  return (
    <div className={`training-field ${error ? 'training-field--error' : ''} ${className}`.trim()}>
      {label && <label htmlFor={inputId}>{label}{props.required && <span aria-hidden="true"> *</span>}</label>}
      <Component
        ref={ref}
        id={inputId}
        className={`training-input ${multiline ? 'training-input--textarea' : ''} ${inputClassName}`.trim()}
        aria-invalid={Boolean(error)}
        aria-describedby={error || hint ? messageId : undefined}
        {...props}
      />
      {(error || hint) && <span id={messageId} className="field-message" role={error ? 'alert' : undefined}>{error || hint}</span>}
    </div>
  );
});
