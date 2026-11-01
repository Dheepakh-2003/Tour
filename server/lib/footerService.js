import { randomUUID } from 'node:crypto';
import { removeUnreferenced, toImage } from './imageUsage.js';
import { readFooter, updateFooter } from './storage.js';
import { validatePeople } from './validate.js';

export const getFooter = () => readFooter();

/** Replaces the whole list of footer profiles. */
export async function saveFooter(fields) {
  const people = validatePeople(fields.people).map(({ id, name, imagePath }) => {
    const image = imagePath ? toImage(imagePath) : null;
    return { id: id ?? randomUUID(), name, image: image?.url ?? null, imagePath: image?.path ?? null };
  });

  const { next, previous } = await updateFooter((previous) => {
    const next = { people, updatedAt: new Date().toISOString() };
    return { data: next, result: { next, previous } };
  });

  // Photos of removed or replaced profiles are deleted unless used elsewhere.
  const kept = new Set(next.people.map((person) => person.imagePath).filter(Boolean));
  await removeUnreferenced(previous.people.map((person) => person.imagePath).filter((path) => path && !kept.has(path)));
  return next;
}
