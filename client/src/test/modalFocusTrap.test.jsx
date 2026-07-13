import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { TrainingModal } from '../branding/components/TrainingModal';

describe('TrainingModal focus containment', () => {
  it('wraps Shift+Tab from the initially focused dialog container', async () => {
    const user = userEvent.setup();
    render(
      <TrainingModal
        open
        onClose={() => undefined}
        title="Confirm change"
        footer={<button type="button">Confirm</button>}
      >
        <button type="button">First action</button>
      </TrainingModal>,
    );

    expect(screen.getByRole('dialog')).toHaveFocus();
    await user.tab({ shift: true });
    expect(screen.getByRole('button', { name: 'Confirm' })).toHaveFocus();
  });
});
