const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function trapTabKey(event, container) {
  if (event.key !== 'Tab' || !container) return;
  const focusable = [...container.querySelectorAll(FOCUSABLE_SELECTOR)]
    .filter((element) => element.getAttribute('aria-hidden') !== 'true' && element.getAttribute('aria-disabled') !== 'true');
  if (!focusable.length) {
    event.preventDefault();
    return;
  }
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const active = document.activeElement;
  const activeIsFocusable = focusable.includes(active);
  if (event.shiftKey && (active === first || !activeIsFocusable)) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (active === last || !activeIsFocusable)) {
    event.preventDefault();
    first.focus();
  }
}
