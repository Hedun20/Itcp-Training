import type { IUser } from '../models/User';

export function userDto(user: Pick<IUser, '_id' | 'name' | 'email' | 'role' | 'status' | 'avatarUrl' | 'lastLoginAt' | 'createdAt' | 'updatedAt'>) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    avatarUrl: user.avatarUrl,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
