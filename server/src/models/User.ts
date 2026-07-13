import { model, Schema, type HydratedDocument, type Model, type Types } from 'mongoose';

export const USER_ROLES = ['admin', 'learner'] as const;
export const USER_STATUSES = ['active', 'disabled'] as const;

export interface IUser {
  _id: Types.ObjectId;
  name: string;
  email: string;
  normalizedEmail: string;
  passwordHash?: string;
  googleId?: string;
  avatarUrl?: string;
  role: (typeof USER_ROLES)[number];
  status: (typeof USER_STATUSES)[number];
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type UserDocument = HydratedDocument<IUser>;

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, trim: true, maxlength: 254 },
    normalizedEmail: { type: String, required: true, unique: true, index: true, lowercase: true },
    passwordHash: { type: String, select: false },
    googleId: { type: String, sparse: true, unique: true, index: true },
    avatarUrl: { type: String },
    role: { type: String, enum: USER_ROLES, default: 'learner', required: true },
    status: { type: String, enum: USER_STATUSES, default: 'active', required: true },
    lastLoginAt: { type: Date },
  },
  { timestamps: true, versionKey: false },
);

userSchema.index({ status: 1, role: 1 });

export const User: Model<IUser> = model<IUser>('User', userSchema);
