import { createHash, randomBytes } from 'node:crypto';
import { getEnv } from '../config/env';
import { EmailVerificationToken } from '../models/EmailVerificationToken';
import { User, type UserDocument } from '../models/User';
import { AppError } from '../utils/AppError';
import { sendEmailVerificationEmail } from './smtpMailService';

function tokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function verificationUrl(rawToken: string): string {
  const origin = getEnv().allowedOrigins[0]?.replace(/\/$/, '');
  if (!origin) throw new Error('CLIENT_URL must include at least one origin');
  return `${origin}/verify-email?token=${encodeURIComponent(rawToken)}`;
}

export async function sendVerificationEmail(user: UserDocument, requestedByIp?: string): Promise<void> {
  const env = getEnv();
  if (!env.smtpEnabled) throw new Error('SMTP email delivery is not configured');

  await EmailVerificationToken.deleteMany({ userId: user._id, usedAt: { $exists: false } });
  const rawToken = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + env.EMAIL_VERIFICATION_TTL_MINUTES * 60 * 1_000);
  const record = await EmailVerificationToken.create({
    userId: user._id,
    tokenHash: tokenHash(rawToken),
    expiresAt,
    requestedByIp,
  });

  try {
    await sendEmailVerificationEmail({
      to: user.email,
      name: user.name,
      verificationUrl: verificationUrl(rawToken),
      expiresInMinutes: env.EMAIL_VERIFICATION_TTL_MINUTES,
    });
  } catch (error) {
    await EmailVerificationToken.deleteOne({ _id: record._id });
    throw error;
  }
}

export async function resendVerificationEmail(normalizedEmail: string, requestedByIp?: string): Promise<void> {
  const user = await User.findOne({ normalizedEmail, status: 'pending_verification' });
  if (!user) return;
  await sendVerificationEmail(user, requestedByIp);
}

export async function verifyEmail(rawToken: string): Promise<void> {
  const claimed = await EmailVerificationToken.findOneAndUpdate(
    {
      tokenHash: tokenHash(rawToken),
      usedAt: { $exists: false },
      expiresAt: { $gt: new Date() },
    },
    { $set: { usedAt: new Date() } },
    { new: true },
  );

  if (!claimed) {
    throw new AppError(400, 'EMAIL_VERIFICATION_INVALID', 'Email verification link is invalid or expired');
  }

  const user = await User.findById(claimed.userId);
  if (!user || user.status === 'disabled') {
    throw new AppError(400, 'EMAIL_VERIFICATION_INVALID', 'Email verification link is invalid or expired');
  }

  if (user.status === 'pending_verification') {
    user.status = 'active';
    user.emailVerifiedAt = new Date();
    await user.save();
  }

  await EmailVerificationToken.deleteMany({ userId: user._id, _id: { $ne: claimed._id } });
}
