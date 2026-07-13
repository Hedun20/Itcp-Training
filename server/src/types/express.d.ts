import type { IUser } from '../models/User';

declare global {
  namespace Express {
    interface User extends IUser {}

    interface Request {
      requestId: string;
      auth?: {
        userId: string;
        role: IUser['role'];
      };
    }
  }
}

export {};
