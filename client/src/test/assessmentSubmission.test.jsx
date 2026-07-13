import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AssessmentPage } from '../pages/learner/AssessmentPage';

const apiMocks = vi.hoisted(() => ({ getCourse: vi.fn(), submit: vi.fn() }));
vi.mock('../api/courses', () => ({ coursesApi: { get: apiMocks.getCourse } }));
vi.mock('../api/learning', () => ({ learningApi: { submitAssessment: apiMocks.submit } }));

describe('AssessmentPage', () => {
  it('locks the submit action while the server scores the assessment', async () => {
    let resolveSubmission;
    apiMocks.getCourse.mockResolvedValue({ _id: 'course-1', slug: 'course-one', code: 'DCT-01', title: 'Course one', passMark: 70, assessment: { questions: [{ id: 'question-1', question: 'Which action is best?', options: ['Review the evidence', 'Guess quickly'], points: 1 }] } });
    apiMocks.submit.mockReturnValue(new Promise((resolve) => { resolveSubmission = resolve; }));
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={['/courses/course-one/assessment']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Routes><Route path="/courses/:slug/assessment" element={<AssessmentPage />} /><Route path="/courses/:slug/results/:attemptId" element={<div>Result route</div>} /></Routes></MemoryRouter>);
    await screen.findByText('Which action is best?');
    await user.click(screen.getByRole('radio', { name: /review the evidence/i }));
    await user.click(screen.getByRole('button', { name: /submit assessment/i }));
    expect(apiMocks.submit).toHaveBeenCalledWith('course-1', [{ questionId: 'question-1', selectedOptionIndex: 0 }]);
    expect(screen.getByRole('button', { name: /working/i })).toBeDisabled();
    resolveSubmission({ id: 'attempt-1', passed: true, percentage: 100 });
    await waitFor(() => expect(screen.getByText('Result route')).toBeInTheDocument());
  });
});
