import { describe, expect, it } from 'vitest';
import { verifiedGoogleEmail } from '../src/config/passport';

describe('Google OAuth identity linking', () => {
  it('accepts only an email explicitly marked verified', () => {
    expect(
      verifiedGoogleEmail({
        emails: [
          { value: 'unverified@example.com', verified: false },
          { value: 'verified@example.com', verified: true },
        ],
      }),
    ).toBe('verified@example.com');
    expect(() => verifiedGoogleEmail({ emails: [{ value: 'unverified@example.com', verified: false }] })).toThrow(
      'verified email',
    );
    expect(() =>
      verifiedGoogleEmail({ emails: [{ value: 'implicit@example.com', verified: undefined as unknown as boolean }] }),
    ).toThrow('verified email');
  });
});
