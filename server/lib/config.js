import { HttpError } from './errors.js';

export const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // Vercel serverless request bodies are capped at ~4.5 MB
export const DATA_PATH = 'data/banners.json';
export const FOOTER_PATH = 'data/footer.json';
export const LOCK_PATH = 'data/banners.lock';
export const UPLOAD_DIR = 'uploads';

export const MAX_IMAGES_PER_BANNER = 8;
export const NAME_MAX = 80;
export const MAX_PEOPLE = 30;
/** Only server-generated upload paths are accepted from clients (path-traversal guard). */
export const IMAGE_PATH_PATTERN = /^uploads\/[A-Za-z0-9._-]+$/;
export const HEADER_MAX = 120;
export const DESCRIPTION_MAX = 2000;

export const isProduction = () => process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);

/** Reads a required env var, failing with a clear (non-secret) message. */
export function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required environment variable: ${name}`);
    throw new HttpError(500, 'Server is not configured correctly.');
  }
  return value;
}

export const bucketName = () => process.env.SUPABASE_BUCKET_NAME || 'tour-storage';
