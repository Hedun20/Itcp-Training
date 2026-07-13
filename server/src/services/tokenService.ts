import { createHash, randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';
import jwt, { type JwtPayload, type SignOptions } from 'jsonwebtoken';
import { Types } from 'mongoose';
import { z } from 'zod';
import { getEnv } from '../config/env';
import { RefreshToken } from '../models/RefreshToken';
import { User, type IUser } from '../models/User';
import { AppError } from '../utils/AppError';

const refreshPayloadSchema = z.object({
  sub: z.string(),
  jti: z.string(),
  family: z.string().uuid(),
  type: z.literal('refresh'),
});

const accessPayloadSchema = z.object({
  sub: z.string(),
  role: z.enum(['admin', 'learner']),
  type: z.literal('access'),
});

const REFRESH_RACE_WINDOW_MS = 5_000;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function requestMetadata(request: Request): { ip?: string; userAgent?: string } {
  return {
    ip: request.ip,
    userAgent: request.get('user-agent')?.slice(0, 1_000),
  };
}

function isBenignRotationRace(record: any, request: Request): boolean {
  if (!record?.revokedAt || !record.replacedByTokenId) return false;
  const age = Date.now() - record.revokedAt.getTime();
  if (age < 0 || age > REFRESH_RACE_WINDOW_MS) return false;
  const metadata = requestMetadata(request);
  return (
    (record.revokedByIp ?? record.createdByIp ?? '') === (metadata.ip ?? '') &&
    (record.userAgent ?? '') === (metadata.userAgent ?? '')
  );
}

async function rejectInactiveRefresh(
  record: any,
  familyId: string,
  request: Request,
  response: Response,
): Promise<never> {
  if (isBenignRotationRace(record, request)) {
    throw new AppError(
      409,
      'REFRESH_RACE_RETRY',
      'This refresh token was just rotated by the same client; retry using the newest cookie',
      { retryable: true, retryAfterMs: 100 },
    );
  }
  await RefreshToken.updateMany(
    { familyId, revokedAt: { $exists: false } },
    { $set: { revokedAt: new Date(), revokedByIp: request.ip } },
  );
  clearRefreshCookie(response);
  throw new AppError(401, 'REFRESH_TOKEN_REUSED', 'Refresh token is no longer active');
}

export function signAccessToken(user: Pick<IUser, '_id' | 'role'>): string {
  const env = getEnv();
  return jwt.sign(
    { role: user.role, type: 'access' },
    env.JWT_ACCESS_SECRET,
    { subject: user._id.toString(), expiresIn: env.ACCESS_TOKEN_TTL as SignOptions['expiresIn'] },
  );
}

export function verifyAccessToken(rawToken: string): z.infer<typeof accessPayloadSchema> {
  try {
    const decoded = jwt.verify(rawToken, getEnv().JWT_ACCESS_SECRET) as JwtPayload;
    return accessPayloadSchema.parse(decoded);
  } catch {
    throw new AppError(401, 'INVALID_ACCESS_TOKEN', 'Access token is invalid or expired');
  }
}

async function createRefreshToken(
  userId: Types.ObjectId | string,
  request: Request,
  familyId: string = randomUUID(),
): Promise<{ rawToken: string; recordId: Types.ObjectId; expiresAt: Date; familyId: string }> {
  const env = getEnv();
  const recordId = new Types.ObjectId();
  const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1_000);
  const rawToken = jwt.sign(
    { family: familyId, type: 'refresh' },
    env.JWT_REFRESH_SECRET,
    { subject: userId.toString(), jwtid: recordId.toString(), expiresIn: `${env.REFRESH_TOKEN_TTL_DAYS}d` },
  );
  const metadata = requestMetadata(request);
  await RefreshToken.create({
    _id: recordId,
    userId,
    tokenHash: hashToken(rawToken),
    familyId,
    expiresAt,
    createdByIp: metadata.ip,
    userAgent: metadata.userAgent,
  });
  return { rawToken, recordId, expiresAt, familyId };
}

function cookieOptions(expiresAt?: Date) {
  const env = getEnv();
  return {
    httpOnly: true,
    secure: env.COOKIE_SECURE ?? env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/api/v1/auth',
    ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
    ...(expiresAt ? { expires: expiresAt } : {}),
  };
}

export function setRefreshCookie(response: Response, rawToken: string, expiresAt: Date): void {
  response.cookie(getEnv().REFRESH_COOKIE_NAME, rawToken, cookieOptions(expiresAt));
}

export function clearRefreshCookie(response: Response): void {
  response.clearCookie(getEnv().REFRESH_COOKIE_NAME, cookieOptions());
}

export async function issueSession(user: IUser, request: Request, response: Response): Promise<string> {
  const refresh = await createRefreshToken(user._id, request);
  setRefreshCookie(response, refresh.rawToken, refresh.expiresAt);
  return signAccessToken(user);
}

function decodeRefresh(rawToken: string): z.infer<typeof refreshPayloadSchema> {
  try {
    const decoded = jwt.verify(rawToken, getEnv().JWT_REFRESH_SECRET) as JwtPayload;
    return refreshPayloadSchema.parse(decoded);
  } catch {
    throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'Refresh token is invalid or expired');
  }
}

export async function rotateRefreshToken(
  rawToken: string,
  request: Request,
  response: Response,
): Promise<{ accessToken: string; user: IUser }> {
  const payload = decodeRefresh(rawToken);
  const record = await RefreshToken.findOne({
    _id: payload.jti,
    userId: payload.sub,
    tokenHash: hashToken(rawToken),
  }).select('+tokenHash');

  if (!record || record.revokedAt || record.expiresAt.getTime() <= Date.now()) {
    return rejectInactiveRefresh(record, payload.family, request, response);
  }

  const user = await User.findById(payload.sub);
  if (!user || user.status !== 'active') {
    await RefreshToken.updateMany(
      { familyId: payload.family, revokedAt: { $exists: false } },
      { $set: { revokedAt: new Date(), revokedByIp: request.ip } },
    );
    clearRefreshCookie(response);
    throw new AppError(401, 'ACCOUNT_UNAVAILABLE', 'Account is unavailable');
  }

  const replacement = await createRefreshToken(user._id, request, payload.family);
  const rotated = await RefreshToken.findOneAndUpdate(
    { _id: record._id, revokedAt: { $exists: false } },
    {
      $set: {
        revokedAt: new Date(),
        revokedByIp: request.ip,
        replacedByTokenId: replacement.recordId,
      },
    },
  );

  if (!rotated) {
    await RefreshToken.deleteOne({ _id: replacement.recordId, revokedAt: { $exists: false } });
    const latestRecord = await RefreshToken.findById(record._id).select('+tokenHash');
    return rejectInactiveRefresh(latestRecord, payload.family, request, response);
  }

  setRefreshCookie(response, replacement.rawToken, replacement.expiresAt);
  return { accessToken: signAccessToken(user), user };
}

export async function revokeRefreshToken(rawToken: string | undefined, request: Request): Promise<void> {
  if (!rawToken) return;
  try {
    const payload = decodeRefresh(rawToken);
    await RefreshToken.updateOne(
      { _id: payload.jti, tokenHash: hashToken(rawToken), revokedAt: { $exists: false } },
      { $set: { revokedAt: new Date(), revokedByIp: request.ip } },
    );
  } catch {
    // Logout remains idempotent even when the cookie is malformed or expired.
  }
}
