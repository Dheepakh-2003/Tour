import { randomUUID } from 'node:crypto';
import { HttpError } from './errors.js';
import { deleteImage, readBanners, updateBanners, uploadImage } from './storage.js';
import { validateId, validateImage, validateText } from './validate.js';

const isImageStillUsed = (banners, imagePath) => banners.some((banner) => banner.imagePath === imagePath);

export const listBanners = () => readBanners();

export async function getBanner(id) {
  const banner = (await readBanners()).find((item) => item.id === validateId(id));
  if (!banner) throw new HttpError(404, 'Banner not found.');
  return banner;
}

export async function createBanner(fields, file) {
  const text = validateText(fields);
  if (!file) throw new HttpError(400, 'Image is required.');
  const image = validateImage(file);

  const uploaded = await uploadImage(image);
  const now = new Date().toISOString();
  const banner = { id: randomUUID(), image: uploaded.imageUrl, imagePath: uploaded.imagePath, ...text, createdAt: now, updatedAt: now };

  try {
    await updateBanners((banners) => ({ banners: [...banners, banner], result: banner }));
  } catch (error) {
    await deleteImage(uploaded.imagePath); // do not leave an orphaned upload behind
    throw error;
  }
  return banner;
}

export async function updateBanner(id, fields, file) {
  const bannerId = validateId(id);
  const text = validateText(fields);
  const image = file ? validateImage(file) : null;
  const uploaded = image ? await uploadImage(image) : null;

  let outcome;
  try {
    outcome = await updateBanners((banners) => {
      const index = banners.findIndex((item) => item.id === bannerId);
      if (index === -1) throw new HttpError(404, 'Banner not found.');
      const previous = banners[index];
      const updated = {
        ...previous,
        ...text,
        ...(uploaded ? { image: uploaded.imageUrl, imagePath: uploaded.imagePath } : {}),
        updatedAt: new Date().toISOString(),
      };
      const next = banners.slice();
      next[index] = updated;
      return { banners: next, result: { updated, previous, remaining: next } };
    });
  } catch (error) {
    if (uploaded) await deleteImage(uploaded.imagePath);
    throw error;
  }

  const { updated, previous, remaining } = outcome;
  if (uploaded && previous.imagePath !== updated.imagePath && !isImageStillUsed(remaining, previous.imagePath)) {
    await deleteImage(previous.imagePath);
  }
  return updated;
}

export async function deleteBanner(id) {
  const bannerId = validateId(id);
  const { removed, remaining } = await updateBanners((banners) => {
    const removed = banners.find((item) => item.id === bannerId);
    if (!removed) throw new HttpError(404, 'Banner not found.');
    const remaining = banners.filter((item) => item.id !== bannerId);
    return { banners: remaining, result: { removed, remaining } };
  });
  if (!isImageStillUsed(remaining, removed.imagePath)) await deleteImage(removed.imagePath);
}
