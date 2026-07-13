import type { RequestHandler } from 'express';
import { User } from '../models/User';
import { verifyAccessToken } from '../services/tokenService';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';

export const authenticate = asyncHandler(async (request, _response, next) => {
  const authorization = request.get('authorization');
  if (!authorization?.startsWith('Bearer ')) {
    throw new AppError(401, 'AUTHENTICATION_REQUIRED', 'A Bearer access token is required');
  }

  const payload = verifyAccessToken(authorization.slice(7));
  const user = await User.findById(payload.sub);
  if (!user || user.status !== 'active') throw new AppError(401, 'ACCOUNT_UNAVAILABLE', 'Account is unavailable');
  if (user.role !== payload.role) throw new AppError(401, 'STALE_ACCESS_TOKEN', 'Sign in again to continue');

  request.auth = { userId: user._id.toString(), role: user.role };
  request.user = user;
  next();
});

export function requireRole(...roles: Array<'admin' | 'learner'>): RequestHandler {
  return (request, _response, next) => {
    if (!request.auth) return next(new AppError(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required'));
    if (!roles.includes(request.auth.role)) {
      return next(new AppError(403, 'FORBIDDEN', 'You do not have permission to perform this action'));
    }
    next();
  };
}
