import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ThemeToggle } from '../branding/components/ThemeToggle';
import { ThemeProvider } from '../branding/theme/ThemeProvider';
import { THEME_STORAGE_KEY } from '../branding/theme/tokens';

describe('theme persistence', () => {
  it('restores and persists the ITCP branding theme key', async () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'light');
    const user = userEvent.setup();
    render(<ThemeProvider><ThemeToggle /></ThemeProvider>);
    expect(document.documentElement.dataset.theme).toBe('light');
    await user.click(screen.getByRole('button', { name: /switch to dark theme/i }));
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem('itcp-branding-theme')).toBe('dark');
  });

  it('still switches themes when browser storage is unavailable', async () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new DOMException('Blocked'); });
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Blocked'); });
    const user = userEvent.setup();
    render(<ThemeProvider><ThemeToggle /></ThemeProvider>);
    const initialTheme = document.documentElement.dataset.theme;

    await user.click(screen.getByRole('button', { name: new RegExp(`switch to ${initialTheme === 'dark' ? 'light' : 'dark'} theme`, 'i') }));

    expect(document.documentElement.dataset.theme).toBe(initialTheme === 'dark' ? 'light' : 'dark');
    getItem.mockRestore();
    setItem.mockRestore();
  });
});
