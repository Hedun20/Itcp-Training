import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { RequestHandler } from 'express';
import multer from 'multer';
import { getEnv } from '../config/env';
import { AppError } from '../utils/AppError';

const mimeExtensions: Record<string, string[]> = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'image/gif': ['.gif'],
};
const canonicalExtension: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

let configuredUpload: RequestHandler | undefined;

export function imageUpload(): RequestHandler {
  return (request, response, next) => {
    if (!configuredUpload) {
      const env = getEnv();
      fs.mkdirSync(env.uploadsDirectory, { recursive: true });
      configuredUpload = multer({
    storage: multer.diskStorage({
      destination: env.uploadsDirectory,
      filename: (_request, file, done) => done(null, `${randomUUID()}${canonicalExtension[file.mimetype] ?? ''}`),
    }),
    limits: { fileSize: env.UPLOAD_MAX_BYTES, files: 1, fields: 10, fieldSize: 10_000 },
    fileFilter: (_request, file, done) => {
      const extension = path.extname(file.originalname).toLowerCase();
      const extensions = mimeExtensions[file.mimetype];
      const stemExtension = path.extname(path.basename(file.originalname, extension)).toLowerCase();
      const dangerousSecondaryExtensions = new Set(['.exe', '.com', '.bat', '.cmd', '.ps1', '.js', '.html', '.svg', '.php', '.sh']);
      if (!extensions || !extensions.includes(extension) || dangerousSecondaryExtensions.has(stemExtension)) {
        return done(new AppError(422, 'INVALID_IMAGE_TYPE', 'Only JPEG, PNG, WebP, and GIF images are allowed'));
      }
      done(null, true);
    },
      }).single('image');
    }
    configuredUpload(request, response, next);
  };
}

export async function hasValidImageSignature(file: Express.Multer.File): Promise<boolean> {
  const handle = await fs.promises.open(file.path, 'r');
  try {
    const buffer = Buffer.alloc(12);
    await handle.read(buffer, 0, buffer.length, 0);
    switch (file.mimetype) {
      case 'image/jpeg':
        return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
      case 'image/png':
        return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
      case 'image/gif':
        return ['GIF87a', 'GIF89a'].includes(buffer.subarray(0, 6).toString('ascii'));
      case 'image/webp':
        return buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
      default:
        return false;
    }
  } finally {
    await handle.close();
  }
}
