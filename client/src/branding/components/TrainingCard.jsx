import { forwardRef, useRef } from 'react';
import { useReducedMotion } from '../../hooks/useReducedMotion';

export const TrainingCard = forwardRef(function TrainingCard(
  { as: Component = 'section', tone = 'default', interactive = false, className = '', children, ...props },
  forwardedRef,
) {
  const ownRef = useRef(null);
  const reducedMotion = useReducedMotion();

  const setRef = (node) => {
    ownRef.current = node;
    if (typeof forwardedRef === 'function') forwardedRef(node);
    else if (forwardedRef) forwardedRef.current = node;
  };

  const onPointerMove = (event) => {
    props.onPointerMove?.(event);
    if (!interactive || reducedMotion || !ownRef.current) return;
    const rect = ownRef.current.getBoundingClientRect();
    ownRef.current.style.setProperty('--card-x', `${event.clientX - rect.left}px`);
    ownRef.current.style.setProperty('--card-y', `${event.clientY - rect.top}px`);
  };

  return (
    <Component
      ref={setRef}
      className={`training-card training-card--${tone} ${interactive ? 'training-card--interactive' : ''} ${className}`.trim()}
      {...props}
      onPointerMove={onPointerMove}
    >
      {children}
    </Component>
  );
});
