import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CourseContent } from '../components/CourseContent';

describe('CourseContent', () => {
  it('renders every structured training content block without flattening article text', () => {
    render(<CourseContent blocks={[
      { id: 'h2', type: 'heading', level: 2, text: 'Section heading' },
      { id: 'h3', type: 'heading', level: 3, text: 'Subsection heading' },
      { id: 'h4', type: 'heading', level: 4, text: 'Detail heading' },
      { id: 'p', type: 'paragraph', text: 'Original training paragraph in full.' },
      { id: 'image', type: 'image', url: '/course-placeholder-safety.svg', altText: 'Neutral safety training visual', caption: 'Safety visual', placeholder: true },
      { id: 'callout', type: 'callout', tone: 'warning', title: 'Remember', text: 'Follow the approved process.' },
      { id: 'checklist', type: 'checklist', items: ['Review the task', 'Record completion'] },
    ]} />);

    expect(screen.getByRole('heading', { level: 2, name: 'Section heading' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Subsection heading' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 4, name: 'Detail heading' })).toBeInTheDocument();
    expect(screen.getByText('Original training paragraph in full.')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Neutral safety training visual' })).toBeInTheDocument();
    expect(screen.getByText('Safety visual')).toBeInTheDocument();
    expect(screen.getByText('Training visual placeholder')).toBeInTheDocument();
    expect(screen.getByText('Follow the approved process.')).toBeInTheDocument();
    expect(screen.getByText('Review the task')).toBeInTheDocument();
    expect(screen.getByText('Record completion')).toBeInTheDocument();
  });
});
