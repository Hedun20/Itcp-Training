import { model, Schema, type HydratedDocument, type Model, type Types } from 'mongoose';

export interface IPasswordResetToken {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  tokenHash: string;
  expiresAt: Date;
  usedAt?: Date;
  requestedByIp?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type PasswordResetTokenDocument = HydratedDocument<IPasswordResetToken>;

const passwordResetTokenSchema = new Schema<IPasswordResetToken>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true, index: true },
    expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
    usedAt: { type: Date },
    requestedByIp: { type: String, maxlength: 128 },
  },
  { timestamps: true, versionKey: false },
);

passwordResetTokenSchema.index({ userId: 1, usedAt: 1, expiresAt: 1 });

export const PasswordResetToken: Model<IPasswordResetToken> = model<IPasswordResetToken>(
  'PasswordResetToken',
  passwordResetTokenSchema,
);
