import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CoursePlayerPage } from '../pages/learner/CoursePlayerPage';

const apiMocks = vi.hoisted(() => ({ getCourse: vi.fn(), getProgress: vi.fn(), saveProgress: vi.fn() }));
vi.mock('../api/courses', () => ({ coursesApi: { get: apiMocks.getCourse } }));
vi.mock('../api/learning', () => ({ learningApi: { courseProgress: apiMocks.getProgress, saveProgress: apiMocks.saveProgress } }));

const course = {
  id: 'course-1',
  slug: 'original-training',
  code: 'DCT-01',
  title: 'Original training',
  modules: [
    { id: '111111111111111111111111', title: 'First module', blocks: [{ id: 'p1', type: 'paragraph', text: 'The complete first article paragraph.' }] },
    { id: '222222222222222222222222', title: 'Second module', blocks: [{ id: 'p2', type: 'paragraph', text: 'The complete second article paragraph.' }] },
  ],
};

describe('learner course article flow', () => {
  beforeEach(() => {
    apiMocks.getCourse.mockResolvedValue(course);
    apiMocks.getProgress.mockResolvedValue({ currentModuleIndex: 0, completedModuleIds: [] });
    apiMocks.saveProgress.mockImplementation(async (_courseId, update) => ({ ...update, status: 'in_progress' }));
  });

  it('keeps lesson content visible, saves completion, and moves to the next article', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={['/courses/original-training/learn/0']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Routes><Route path="/courses/:slug/learn/:moduleIndex" element={<CoursePlayerPage />} /><Route path="/courses/:slug/assessment" element={<div>Assessment destination</div>} /></Routes></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'First module' })).toBeInTheDocument();
    expect(screen.getByText('The complete first article paragraph.')).toBeInTheDocument();
    expect(screen.getByText('Course progress')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /complete & continue/i }));
    expect(await screen.findByRole('heading', { name: 'Second module' })).toBeInTheDocument();
    expect(screen.getByText('The complete second article paragraph.')).toBeInTheDocument();
    await waitFor(() => expect(apiMocks.saveProgress).toHaveBeenCalledWith('course-1', expect.objectContaining({
      currentModuleIndex: 1,
      completedModuleIds: ['111111111111111111111111'],
    })));
    expect(screen.getByRole('button', { name: /complete & take assessment/i })).toBeInTheDocument();
  });

  it('does not let navigation race the initial progress save', async () => {
    const user = userEvent.setup();
    let resolveInitialSave;
    apiMocks.saveProgress
      .mockImplementationOnce(() => new Promise((resolve) => { resolveInitialSave = resolve; }))
      .mockImplementation(async (_courseId, update) => ({ ...update, status: 'in_progress' }));
    render(<MemoryRouter initialEntries={['/courses/original-training/learn/0']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Routes><Route path="/courses/:slug/learn/:moduleIndex" element={<CoursePlayerPage />} /></Routes></MemoryRouter>);
    const pendingButton = await screen.findByRole('button', { name: /working/i });
    expect(pendingButton).toBeDisabled();
    await user.click(pendingButton);
    expect(apiMocks.saveProgress).toHaveBeenCalledTimes(1);
    await act(async () => resolveInitialSave({ currentModuleIndex: 0, completedModuleIds: [], status: 'in_progress' }));
    const continueButton = await screen.findByRole('button', { name: /complete & continue/i });
    expect(continueButton).toBeEnabled();
    await user.click(continueButton);
    await waitFor(() => expect(apiMocks.saveProgress).toHaveBeenCalledTimes(2));
  });
});
