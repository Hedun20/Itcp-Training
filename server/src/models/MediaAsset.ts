import { model, Schema, type HydratedDocument, type Model, type Types } from 'mongoose';

export interface IMediaAsset {
  _id: Types.ObjectId;
  originalName: string;
  storedName: string;
  mimeType: string;
  size: number;
  url: string;
  altText: string;
  storageProvider: 'local';
  uploadedBy: Types.ObjectId;
  createdAt: Date;
}

export type MediaAssetDocument = HydratedDocument<IMediaAsset>;

const mediaAssetSchema = new Schema<IMediaAsset>(
  {
    originalName: { type: String, required: true, maxlength: 255 },
    storedName: { type: String, required: true, unique: true, maxlength: 255 },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true, min: 1 },
    url: { type: String, required: true },
    altText: { type: String, required: true, trim: true, maxlength: 500 },
    storageProvider: { type: String, enum: ['local'], default: 'local', required: true },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);

export const MediaAsset: Model<IMediaAsset> = model<IMediaAsset>('MediaAsset', mediaAssetSchema);
