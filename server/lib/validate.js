import { DESCRIPTION_MAX, HEADER_MAX, IMAGE_PATH_PATTERN, MAX_IMAGE_BYTES, MAX_IMAGES_PER_BANNER, MAX_PEOPLE, NAME_MAX } from './config.js';
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

export function validateImagePath(value) {
  if (typeof value !== 'string' || !IMAGE_PATH_PATTERN.test(value) || value.includes('..')) {
    throw new HttpError(400, 'Invalid image reference.');
  }
  return value;
}

export function validateImagePaths(value) {
  if (!Array.isArray(value) || value.length === 0) throw new HttpError(400, 'At least one image is required.');
  if (value.length > MAX_IMAGES_PER_BANNER) throw new HttpError(400, `A banner can have at most ${MAX_IMAGES_PER_BANNER} images.`);
  const paths = value.map(validateImagePath);
  if (new Set(paths).size !== paths.length) throw new HttpError(400, 'Duplicate images are not allowed.');
  return paths;
}

const PERSON_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

/** Footer profiles: [{ id?, name, imagePath? }]. An empty list clears the footer. */
export function validatePeople(value) {
  if (!Array.isArray(value)) throw new HttpError(400, 'People must be a list.');
  if (value.length > MAX_PEOPLE) throw new HttpError(400, `The footer can have at most ${MAX_PEOPLE} people.`);
  return value.map((person) => {
    if (!person || typeof person !== 'object') throw new HttpError(400, 'Invalid person.');
    if (person.id !== undefined && person.id !== null && !PERSON_ID_PATTERN.test(String(person.id))) {
      throw new HttpError(400, 'Invalid person id.');
    }
    return {
      id: person.id ? String(person.id) : null,
      name: cleanText(person.name, 'Name', NAME_MAX),
      imagePath: person.imagePath ? validateImagePath(person.imagePath) : null,
    };
  });
}
