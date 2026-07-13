import { model, Schema, type HydratedDocument, type Model, type Types } from 'mongoose';

export interface IRefreshToken {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  tokenHash: string;
  familyId: string;
  expiresAt: Date;
  revokedAt?: Date;
  replacedByTokenId?: Types.ObjectId;
  createdByIp?: string;
  revokedByIp?: string;
  userAgent?: string;
  createdAt: Date;
}

export type RefreshTokenDocument = HydratedDocument<IRefreshToken>;

const refreshTokenSchema = new Schema<IRefreshToken>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true, select: false },
    familyId: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
    revokedAt: Date,
    replacedByTokenId: { type: Schema.Types.ObjectId, ref: 'RefreshToken' },
    createdByIp: String,
    revokedByIp: String,
    userAgent: { type: String, maxlength: 1_000 },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);

refreshTokenSchema.index({ familyId: 1, revokedAt: 1 });

export const RefreshToken: Model<IRefreshToken> = model<IRefreshToken>('RefreshToken', refreshTokenSchema);
