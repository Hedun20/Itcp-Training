import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import { getEnv } from '../config/env';
import { PasswordResetToken } from '../models/PasswordResetToken';
import { RefreshToken } from '../models/RefreshToken';
import { User } from '../models/User';
import { sendPasswordResetEmail } from './googleMailService';
import { AppError } from '../utils/AppError';

function tokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function resetUrl(rawToken: string): string {
  const origin = getEnv().allowedOrigins[0]?.replace(/\/$/, '');
  if (!origin) throw new Error('CLIENT_URL must include at least one origin');
  return `${origin}/reset-password?token=${encodeURIComponent(rawToken)}`;
}

export async function requestPasswordReset(normalizedEmail: string, requestedByIp?: string): Promise<void> {
  const env = getEnv();
  const user = await User.findOne({ normalizedEmail, status: 'active' });
  if (!user) return;

  await PasswordResetToken.deleteMany({ userId: user._id, usedAt: { $exists: false } });
  const rawToken = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + env.PASSWORD_RESET_TTL_MINUTES * 60 * 1_000);
  const record = await PasswordResetToken.create({
    userId: user._id,
    tokenHash: tokenHash(rawToken),
    expiresAt,
    requestedByIp,
  });

  try {
    await sendPasswordResetEmail({
      to: user.email,
      name: user.name,
      resetUrl: resetUrl(rawToken),
      expiresInMinutes: env.PASSWORD_RESET_TTL_MINUTES,
    });
  } catch (error) {
    await PasswordResetToken.deleteOne({ _id: record._id });
    console.error('Password reset email delivery failed', error);
  }
}

export async function resetPassword(rawToken: string, newPassword: string, requestIp?: string): Promise<void> {
  const claimed = await PasswordResetToken.findOneAndUpdate(
    {
      tokenHash: tokenHash(rawToken),
      usedAt: { $exists: false },
      expiresAt: { $gt: new Date() },
    },
    { $set: { usedAt: new Date() } },
    { new: true },
  );

  if (!claimed) {
    throw new AppError(400, 'PASSWORD_RESET_INVALID', 'Password reset link is invalid or expired');
  }

  const user = await User.findById(claimed.userId).select('+passwordHash');
  if (!user || user.status !== 'active') {
    throw new AppError(400, 'PASSWORD_RESET_INVALID', 'Password reset link is invalid or expired');
  }

  user.passwordHash = await bcrypt.hash(newPassword, 12);
  await user.save();
  await RefreshToken.updateMany(
    { userId: user._id, revokedAt: { $exists: false } },
    { $set: { revokedAt: new Date(), revokedByIp: requestIp } },
  );
  await PasswordResetToken.deleteMany({ userId: user._id, _id: { $ne: claimed._id } });
}
