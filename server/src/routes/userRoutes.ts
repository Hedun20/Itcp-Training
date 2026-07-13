import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { User, type UserDocument } from '../models/User';
import { recordAudit } from '../services/auditService';
import { userDto } from '../services/userService';
import { AppError } from '../utils/AppError';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();
router.use(authenticate);

router.get(
  '/',
  requireRole('admin'),
  asyncHandler(async (_request, response) => {
    const users = await User.find().sort({ createdAt: -1 }).limit(1_000);
    const data = users.map(userDto);
    response.json({ data, users: data });
  }),
);

router.get('/me', (request, response) => {
  const data = userDto(request.user!);
  response.json({ data, user: data });
});

router.patch(
  '/me',
  validate({ body: z.object({ name: z.string().trim().min(2).max(120) }).strict() }),
  asyncHandler(async (request, response) => {
    const currentUser = request.user as UserDocument;
    currentUser.name = request.body.name;
    await currentUser.save();
    const data = userDto(currentUser);
    response.json({ data, user: data });
  }),
);

router.patch(
  '/:id',
  requireRole('admin'),
  validate({
    params: z.object({ id: z.string().regex(/^[a-f\d]{24}$/i) }),
    body: z
      .object({ role: z.enum(['admin', 'learner']).optional(), status: z.enum(['active', 'disabled']).optional() })
      .strict()
      .refine((body) => body.role !== undefined || body.status !== undefined, 'Role or status is required'),
  }),
  asyncHandler(async (request, response) => {
    const user = await User.findById(request.params.id);
    if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
    if (user._id.toString() === request.auth!.userId && (request.body.role === 'learner' || request.body.status === 'disabled')) {
      throw new AppError(409, 'SELF_LOCKOUT_PREVENTED', 'You cannot remove your own administrator access');
    }
    const previousRole = user.role;
    const previousStatus = user.status;
    if (request.body.role) user.role = request.body.role;
    if (request.body.status) user.status = request.body.status;
    await user.save();
    if (user.role !== previousRole) await recordAudit(request, 'user.role_changed', 'user', user._id, { from: previousRole, to: user.role });
    if (user.status !== previousStatus) await recordAudit(request, 'user.status_changed', 'user', user._id, { from: previousStatus, to: user.status });
    const data = userDto(user);
    response.json({ data, user: data });
  }),
);

export { router as userRoutes };
