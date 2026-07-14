import fs from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import { z } from 'zod';
import { getEnv } from '../config/env';
import { authenticate, requireRole } from '../middleware/auth';
import { hasValidImageSignature, imageUpload } from '../middleware/upload';
import { validate } from '../middleware/validate';
import { Course } from '../models/Course';
import { MediaAsset } from '../models/MediaAsset';
import { recordAudit } from '../services/auditService';
import { AppError } from '../utils/AppError';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();
router.use(authenticate, requireRole('admin', 'instructor'));

const idParams = z.object({ id: z.string().regex(/^[a-f\d]{24}$/i) });

function mediaDto(asset: any) {
  return {
    id: asset._id.toString(),
    originalName: asset.originalName,
    mimeType: asset.mimeType,
    size: asset.size,
    url: asset.url,
    altText: asset.altText,
    uploadedBy: asset.uploadedBy.toString(),
    createdAt: asset.createdAt,
  };
}

router.get(
  '/',
  asyncHandler(async (request, response) => {
    const filter = request.auth!.role === 'admin' ? {} : { uploadedBy: request.auth!.userId };
    const assets = await MediaAsset.find(filter).sort({ createdAt: -1 }).limit(500);
    const data = assets.map(mediaDto);
    response.json({ data, media: data });
  }),
);

router.post(
  '/',
  imageUpload(),
  asyncHandler(async (request, response) => {
    if (!request.file) throw new AppError(422, 'IMAGE_REQUIRED', 'An image file is required in the image field');
    const altResult = z.string().trim().min(1).max(500).safeParse(request.body.altText);
    if (!altResult.success || !(await hasValidImageSignature(request.file))) {
      await fs.promises.unlink(request.file.path).catch(() => undefined);
      if (!altResult.success) throw new AppError(422, 'VALIDATION_ERROR', 'Alt text is required for uploaded images', altResult.error.flatten());
      throw new AppError(422, 'INVALID_IMAGE_CONTENT', 'The file content does not match a supported image format');
    }
    let asset;
    try {
      asset = await MediaAsset.create({
        originalName: path.basename(request.file.originalname),
        storedName: request.file.filename,
        mimeType: request.file.mimetype,
        size: request.file.size,
        url: `/uploads/${encodeURIComponent(request.file.filename)}`,
        altText: altResult.data,
        storageProvider: 'local',
        uploadedBy: request.auth!.userId,
      });
    } catch (error) {
      await fs.promises.unlink(request.file.path).catch(() => undefined);
      throw error;
    }
    await recordAudit(request, 'media.uploaded', 'media', asset._id, { mimeType: asset.mimeType, size: asset.size });
    const data = mediaDto(asset);
    response.status(201).json({ data, media: data });
  }),
);

router.delete(
  '/:id',
  validate({ params: idParams }),
  asyncHandler(async (request, response) => {
    const asset = await MediaAsset.findById(request.params.id);
    if (!asset) throw new AppError(404, 'MEDIA_NOT_FOUND', 'Media asset not found');
    if (
      request.auth!.role === 'instructor' &&
      asset.uploadedBy.toString() !== request.auth!.userId
    ) {
      throw new AppError(403, 'MEDIA_OWNERSHIP_REQUIRED', 'You can delete only media that you uploaded');
    }
    const usedByCourses = await Course.find({
      $or: [{ coverImage: asset.url }, { 'modules.blocks.url': asset.url }],
    })
      .select('code title status')
      .limit(100)
      .lean();
    if (usedByCourses.length) {
      throw new AppError(409, 'MEDIA_IN_USE', 'Media asset is referenced by one or more courses', {
        usageCount: usedByCourses.length,
        ...(request.auth!.role === 'admin'
          ? {
              courses: usedByCourses.map((course) => ({
                id: course._id.toString(),
                code: course.code,
                title: course.title,
                status: course.status,
              })),
            }
          : {}),
      });
    }
    const uploadsRoot = path.resolve(getEnv().uploadsDirectory);
    const filePath = path.resolve(uploadsRoot, path.basename(asset.storedName));
    if (path.dirname(filePath) !== uploadsRoot) throw new AppError(400, 'UNSAFE_MEDIA_PATH', 'Stored media path is invalid');
    await fs.promises.unlink(filePath).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'ENOENT') throw error;
    });
    await asset.deleteOne();
    await recordAudit(request, 'media.deleted', 'media', asset._id, { storedName: asset.storedName });
    response.status(204).send();
  }),
);

export { router as mediaRoutes };
