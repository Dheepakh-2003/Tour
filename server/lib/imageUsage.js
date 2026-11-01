import { deleteImage, imageUrl, readBanners, readFooter } from './storage.js';

export const toImage = (path) => ({ path, url: imageUrl(path) });

/** Every image path currently used by a banner or the footer. */
export async function referencedPaths() {
  const [banners, footer] = await Promise.all([readBanners(), readFooter()]);
  return new Set([...banners.flatMap((banner) => banner.images.map((image) => image.path)), ...footer.people.map((person) => person.imagePath)].filter(Boolean));
}

/** Deletes the given uploads, skipping any that are still referenced somewhere. */
export async function removeUnreferenced(paths) {
  if (paths.length === 0) return;
  const used = await referencedPaths();
  await Promise.all(paths.filter((path) => !used.has(path)).map(deleteImage));
}
