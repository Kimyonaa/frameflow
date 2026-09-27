import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { HttpError } from './store.js';
export async function inspectFile(file) {
  if (!file) throw new HttpError(400, 'Choose an image or PDF.');
  const bytes = file.buffer;
  const common = {
    name: file.originalname.replace(/[^\w .()-]/g, '_').slice(0, 140),
    size: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  };
  if (bytes.subarray(0, 5).toString() === '%PDF-')
    return { ...common, mime: 'application/pdf', bytes };
  try {
    const meta = await sharp(bytes, { limitInputPixels: 40000000 }).metadata();
    if (!['jpeg', 'png', 'webp'].includes(meta.format)) throw Error();
    const safe = await sharp(bytes, { limitInputPixels: 40000000 })
      .rotate()
      .webp({ quality: 90 })
      .toBuffer({ resolveWithObject: true });
    return {
      ...common,
      mime: 'image/webp',
      bytes: safe.data,
      size: safe.data.length,
      width: safe.info.width,
      height: safe.info.height,
    };
  } catch {
    throw new HttpError(400, 'Use a valid PNG, JPEG, WebP or PDF under 10 MB.');
  }
}
