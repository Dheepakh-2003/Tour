export const ACCEPT = '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp';
export const MAX_BYTES = 4 * 1024 * 1024;

const TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'];
const SKIP_BELOW = 250 * 1024; // already small: upload untouched
const QUALITY = 0.82;

/** Returns an error message when the file is not a JPG, PNG or WEBP image, otherwise ''. */
export function typeProblem(file) {
  const extension = file.name.split('.').pop().toLowerCase();
  return TYPES.includes(file.type) && EXTENSIONS.includes(extension) ? '' : 'Please choose JPG, PNG or WEBP images.';
}

export const sizeProblem = (file) => (file.size > MAX_BYTES ? 'Each image must be smaller than 4 MB.' : '');

/**
 * Photos straight from a phone or camera are several MB, which makes uploads (and the page) slow.
 * Anything over ~250 KB is downscaled to at most `maxSide` pixels and re-encoded as a JPEG in the browser.
 */
export async function prepareImage(file, { maxSide = 1920 } = {}) {
  if (file.size <= SKIP_BELOW) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext('2d');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', QUALITY));
    if (blob && blob.size < file.size) {
      return new File([blob], `${file.name.replace(/\.[^.]+$/, '')}.jpg`, { type: 'image/jpeg' });
    }
  } catch {
    // Fall back to the original file; the server validates it anyway.
  }
  return file;
}
