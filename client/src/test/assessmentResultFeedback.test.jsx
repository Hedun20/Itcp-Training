import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { AssessmentResultPage } from '../pages/learner/AssessmentResultPage';

describe('assessment result feedback', () => {
  it('renders question aliases, correctness, and explanation as escaped text', () => {
    const attempt = {
      id: 'attempt-1',
      passed: true,
      score: 1,
      maximumScore: 1,
      percentage: 100,
      submittedAt: '2026-07-13T10:00:00.000Z',
      feedback: [{
        questionId: 'question-1',
        questionText: '<img src=x onerror=alert(1)>',
        isCorrect: true,
        explanation: '<script>alert(1)</script>',
      }],
    };
    render(
      <MemoryRouter initialEntries={[{ pathname: '/courses/safe-course/results/attempt-1', state: { attempt } }]}>
        <Routes><Route path="/courses/:slug/results/:attemptId" element={<AssessmentResultPage />} /></Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeInTheDocument();
    expect(screen.getByText('<script>alert(1)</script>')).toBeInTheDocument();
    expect(screen.getByLabelText('Correct answer')).toBeInTheDocument();
    expect(document.querySelector('.result-review img')).not.toBeInTheDocument();
    expect(document.querySelector('.result-review script')).not.toBeInTheDocument();
  });
});
