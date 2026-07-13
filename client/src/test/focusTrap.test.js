import { describe, expect, it, vi } from 'vitest';
import { trapTabKey } from '../utils/focus';

describe('mobile drawer focus containment', () => {
  it('wraps forward and reverse Tab movement inside the drawer', () => {
    const drawer = document.createElement('aside');
    const first = document.createElement('button');
    const last = document.createElement('button');
    drawer.append(first, last);
    document.body.append(drawer);

    last.focus();
    const forward = { key: 'Tab', shiftKey: false, preventDefault: vi.fn() };
    trapTabKey(forward, drawer);
    expect(forward.preventDefault).toHaveBeenCalledOnce();
    expect(first).toHaveFocus();

    const reverse = { key: 'Tab', shiftKey: true, preventDefault: vi.fn() };
    trapTabKey(reverse, drawer);
    expect(reverse.preventDefault).toHaveBeenCalledOnce();
    expect(last).toHaveFocus();
    drawer.remove();
  });
});
