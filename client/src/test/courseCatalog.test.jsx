import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { CourseCatalogPage } from '../pages/learner/CourseCatalogPage';

const apiMocks = vi.hoisted(() => ({ list: vi.fn(), progress: vi.fn() }));
vi.mock('../api/courses', () => ({ coursesApi: { list: apiMocks.list } }));
vi.mock('../api/learning', () => ({ learningApi: { myProgress: apiMocks.progress } }));

describe('CourseCatalogPage', () => {
  it('renders courses and calculates progress from the real modules-array API shape', async () => {
    apiMocks.list.mockResolvedValue([{ _id: 'course-1', slug: 'digital-capability', code: 'DCT-01', title: 'Digital Capability Essentials', shortDescription: 'Practical digital foundations.', category: 'Digital', modules: [{ _id: 'm1' }, { _id: 'm2' }, { _id: 'm3' }, { _id: 'm4' }] }]);
    apiMocks.progress.mockResolvedValue([{ courseId: 'course-1', status: 'in_progress', completedModuleIds: ['m1', 'm2'] }]);
    render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><CourseCatalogPage /></MemoryRouter>);
    expect(screen.getByText('Loading available courses…')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Digital Capability Essentials' })).toBeInTheDocument();
    expect(apiMocks.list).toHaveBeenCalledOnce();
    expect(screen.getByText('1 course available')).toBeInTheDocument();
    expect(screen.getByText('50%', { selector: 'strong' })).toBeInTheDocument();
  });
});
