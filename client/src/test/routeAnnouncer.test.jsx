import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RouteAnnouncer } from '../components/RouteAnnouncer';

describe('route announcements', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', vi.fn((callback) => window.setTimeout(callback, 0)));
    vi.stubGlobal('cancelAnimationFrame', vi.fn((id) => window.clearTimeout(id)));
  });

  afterEach(() => vi.unstubAllGlobals());

  it('updates the document title, announces the route, and focuses its heading', async () => {
    render(
      <MemoryRouter initialEntries={['/courses']}>
        <RouteAnnouncer />
        <main id="main-content"><h1>Available courses</h1></main>
      </MemoryRouter>,
    );

    expect(document.title).toBe('Course catalog · ITCP Training');
    expect(screen.getByRole('status')).toHaveTextContent('Course catalog page loaded.');
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Available courses' })).toHaveFocus());
  });
});
