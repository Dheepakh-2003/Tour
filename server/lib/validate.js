import { DESCRIPTION_MAX, HEADER_MAX, MAX_IMAGE_BYTES } from './config.js';
import { HttpError } from './errors.js';

const ALLOWED = {
  'image/jpeg': { extensions: ['jpg', 'jpeg'], canonical: 'jpg' },
  'image/png': { extensions: ['png'], canonical: 'png' },
  'image/webp': { extensions: ['webp'], canonical: 'webp' },
};

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validateId(id) {
  if (typeof id !== 'string' || !UUID_PATTERN.test(id)) throw new HttpError(400, 'Invalid banner id.');
  return id.toLowerCase();
}

function cleanText(value, label, max) {
  if (typeof value !== 'string' || !value.trim()) throw new HttpError(400, `${label} is required.`);
  const text = value.trim();
  if (text.length > max) throw new HttpError(400, `${label} must be ${max} characters or fewer.`);
  return text;
}

export function validateText(fields) {
  return {
    header: cleanText(fields.header, 'Header', HEADER_MAX),
    description: cleanText(fields.description, 'Description', DESCRIPTION_MAX),
  };
}

/** Confirms the real file contents match the claimed image type (not just the header/extension). */
function matchesSignature(buffer, mimeType) {
  if (mimeType === 'image/jpeg') return buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (mimeType === 'image/png') return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (mimeType === 'image/webp') return buffer.length > 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';
  return false;
}

export function validateImage(file) {
  const rule = ALLOWED[file.mimeType];
  const extension = file.filename.includes('.') ? file.filename.split('.').pop().toLowerCase() : '';
  if (!rule || !rule.extensions.includes(extension)) throw new HttpError(400, 'Image must be a JPG, PNG or WEBP file.');
  if (file.buffer.length === 0) throw new HttpError(400, 'The image file is empty.');
  if (file.buffer.length > MAX_IMAGE_BYTES) throw new HttpError(413, `Image must be smaller than ${MAX_IMAGE_BYTES / 1024 / 1024} MB.`);
  if (!matchesSignature(file.buffer, file.mimeType)) throw new HttpError(400, 'The file contents do not match an image type.');
  return { buffer: file.buffer, mimeType: file.mimeType, extension: rule.canonical };
}
