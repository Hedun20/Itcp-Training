import type { IUser } from '../models/User';
import type { PendingGoogleIdentity } from '../config/passport';

declare global {
  namespace Express {
    interface User extends IUser {}

    interface Request {
      requestId: string;
      auth?: {
        userId: string;
        role: IUser['role'];
      };
      googleRegistration?: PendingGoogleIdentity;
    }
  }
}

export {};
