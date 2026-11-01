import { HttpError } from './errors.js';
import { referencedPaths } from './imageUsage.js';
import { deleteImage, uploadImage } from './storage.js';
import { validateImage, validateImagePath } from './validate.js';

/** Stores one validated image and returns its path and public URL. */
export async function createUpload(file) {
  if (!file) throw new HttpError(400, 'Image is required.');
  return uploadImage(validateImage(file));
}

/** Removes an upload the admin abandoned (e.g. cancelled the form). Never touches images in use. */
export async function discardUpload(path) {
  const imagePath = validateImagePath(path);
  if ((await referencedPaths()).has(imagePath)) return;
  await deleteImage(imagePath);
}
