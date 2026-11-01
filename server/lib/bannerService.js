import { randomUUID } from 'node:crypto';
import { HttpError } from './errors.js';
import { removeUnreferenced, toImage } from './imageUsage.js';
import { readBanners, updateBanners } from './storage.js';
import { validateId, validateImagePaths, validateText } from './validate.js';

export const listBanners = () => readBanners();

export async function getBanner(id) {
  const banner = (await readBanners()).find((item) => item.id === validateId(id));
  if (!banner) throw new HttpError(404, 'Banner not found.');
  return banner;
}

export async function createBanner(fields) {
  const text = validateText(fields);
  const images = validateImagePaths(fields.images).map(toImage);
  const now = new Date().toISOString();
  const banner = { id: randomUUID(), ...text, images, createdAt: now, updatedAt: now };
  await updateBanners((banners) => ({ data: [...banners, banner], result: banner }));
  return banner;
}

export async function updateBanner(id, fields) {
  const bannerId = validateId(id);
  const text = validateText(fields);
  const images = validateImagePaths(fields.images).map(toImage);

  const { updated, previous } = await updateBanners((banners) => {
    const index = banners.findIndex((item) => item.id === bannerId);
    if (index === -1) throw new HttpError(404, 'Banner not found.');
    const previous = banners[index];
    const updated = { ...previous, ...text, images, updatedAt: new Date().toISOString() };
    const next = banners.slice();
    next[index] = updated;
    return { data: next, result: { updated, previous } };
  });

  // Images dropped from this banner are removed from storage unless used elsewhere.
  const kept = new Set(images.map((image) => image.path));
  await removeUnreferenced(previous.images.map((image) => image.path).filter((path) => !kept.has(path)));
  return updated;
}

export async function deleteBanner(id) {
  const bannerId = validateId(id);
  const removed = await updateBanners((banners) => {
    const removed = banners.find((item) => item.id === bannerId);
    if (!removed) throw new HttpError(404, 'Banner not found.');
    return { data: banners.filter((item) => item.id !== bannerId), result: removed };
  });
  await removeUnreferenced(removed.images.map((image) => image.path));
}
