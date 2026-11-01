import { randomUUID } from 'node:crypto';
import { DATA_PATH, FOOTER_PATH, IMAGE_PATH_PATTERN, LOCK_PATH, UPLOAD_DIR, bucketName } from './config.js';
import { HttpError } from './errors.js';
import { bucket, fetchObjectText, storage } from './supabase.js';

const LOCK_STALE_MS = 20_000;
const LOCK_TIMEOUT_MS = 12_000;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const EMPTY_FOOTER = { people: [] };
/** JSON files created automatically when missing. */
const INITIAL_FILES = {
  [DATA_PATH]: '[]',
  [FOOTER_PATH]: JSON.stringify(EMPTY_FOOTER),
};

let ready = false;
let readyPromise = null;

const isAlreadyExists = (error) =>
  String(error?.statusCode) === '409' || /already exists|duplicate/i.test(error?.message || '');

/** Creates the bucket and any missing JSON data files. */
async function ensureStorage(force = false) {
  if (ready && !force) return;
  readyPromise ??= (async () => {
    const { data: buckets, error: listError } = await storage().listBuckets();
    if (listError) throw new Error(`Cannot reach Supabase Storage: ${listError.message}`);
    if (!buckets.some((b) => b.name === bucketName())) {
      // Public so visitors' browsers can load banner images directly by URL.
      const { error } = await storage().createBucket(bucketName(), { public: true });
      if (error && !isAlreadyExists(error)) throw new Error(`Cannot create bucket: ${error.message}`);
    }
    const { data: files, error } = await bucket().list('data');
    if (error) throw new Error(`Cannot list data folder: ${error.message}`);
    const existing = new Set(files.map((f) => f.name));
    for (const [path, body] of Object.entries(INITIAL_FILES)) {
      if (existing.has(path.split('/').pop())) continue;
      const { error: createError } = await bucket().upload(path, body, {
        contentType: 'application/json',
        cacheControl: '0',
        upsert: false,
      });
      if (createError && !isAlreadyExists(createError)) throw new Error(`Cannot create ${path}: ${createError.message}`);
    }
    ready = true;
  })().finally(() => {
    readyPromise = null;
  });
  await readyPromise;
}

/* ------------------------------ normalisers ------------------------------ */

/** Banners created before multi-image support stored a single image/imagePath. */
function normalizeBanner(banner) {
  if (Array.isArray(banner.images)) return banner;
  const { image, imagePath, ...rest } = banner;
  return { ...rest, images: imagePath ? [{ path: imagePath, url: image }] : [] };
}

function normalizeBanners(value) {
  if (!Array.isArray(value)) throw new Error('banners.json is corrupted: expected an array.');
  return value.map(normalizeBanner);
}

/** Footers saved before multi-profile support held a single { name, image, imagePath }. */
function normalizeFooter(value) {
  const object = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  if (Array.isArray(object.people)) return { ...object, people: object.people };
  const legacy = object.name || object.imagePath ? [{ id: 'profile-1', name: object.name || '', image: object.image ?? null, imagePath: object.imagePath ?? null }] : [];
  return { people: legacy, updatedAt: object.updatedAt };
}

/* ------------------------------ JSON files ------------------------------- */

async function downloadJson(path, normalize) {
  const text = await fetchObjectText(path);
  if (text === null) throw new Error(`Cannot read ${path}: not found`);
  return normalize(JSON.parse(text));
}

/** Never silently treats a read failure as "empty". */
async function readJson(path, normalize) {
  await ensureStorage();
  try {
    return await downloadJson(path, normalize);
  } catch (firstError) {
    // The file may have been removed while this instance was warm: re-check once.
    await ensureStorage(true);
    try {
      return await downloadJson(path, normalize);
    } catch {
      throw firstError;
    }
  }
}

async function writeJson(path, value) {
  const { error } = await bucket().upload(path, JSON.stringify(value, null, 2), {
    contentType: 'application/json',
    cacheControl: '0',
    upsert: true,
  });
  if (error) throw new Error(`Cannot write ${path}: ${error.message}`);
}

/* ------------------------------------------------------------------ *
 * Write serialisation.
 * 1. In-process queue: serialises writes within one Node process.
 * 2. Lock object in storage: a Supabase `upsert: false` upload is an atomic
 *    "create if absent", so it works as a cross-instance mutex (needed on
 *    serverless, where several instances may run at once). Stale locks
 *    (crashed instance) expire after LOCK_STALE_MS.
 * ------------------------------------------------------------------ */
let queue = Promise.resolve();

async function acquireLock() {
  const deadline = Date.now() + LOCK_TIMEOUT_MS;
  const body = JSON.stringify({ owner: randomUUID(), at: Date.now() });
  for (;;) {
    const { error } = await bucket().upload(LOCK_PATH, body, {
      contentType: 'application/json',
      cacheControl: '0',
      upsert: false,
    });
    if (!error) return;
    if (!isAlreadyExists(error)) throw new Error(`Cannot acquire lock: ${error.message}`);

    // Lock is held — break it only if it is stale.
    const lockText = await fetchObjectText(LOCK_PATH).catch(() => null);
    if (lockText) {
      try {
        const { at } = JSON.parse(lockText);
        if (Date.now() - at > LOCK_STALE_MS) await bucket().remove([LOCK_PATH]);
      } catch {
        await bucket().remove([LOCK_PATH]); // unreadable lock file
      }
    }
    if (Date.now() > deadline) throw new HttpError(503, 'The server is busy, please try again.');
    await sleep(120 + Math.random() * 180);
  }
}

/**
 * Runs `mutator(current)` under an exclusive lock and saves the `data` it returns.
 * The mutator returns `{ data, result }`; `result` is passed back to the caller.
 */
function updateJson(path, normalize, mutator) {
  const run = async () => {
    await ensureStorage();
    await acquireLock();
    try {
      const current = await downloadJson(path, normalize);
      const { data, result } = await mutator(current);
      await writeJson(path, data);
      return result;
    } finally {
      await bucket().remove([LOCK_PATH]).catch(() => {});
    }
  };
  const next = queue.then(run, run);
  queue = next.catch(() => {});
  return next;
}

export const readBanners = () => readJson(DATA_PATH, normalizeBanners);
export const updateBanners = (mutator) => updateJson(DATA_PATH, normalizeBanners, mutator);
export const readFooter = () => readJson(FOOTER_PATH, normalizeFooter);
export const updateFooter = (mutator) => updateJson(FOOTER_PATH, normalizeFooter, mutator);

/* ------------------------------ images ------------------------------ */

export const imageUrl = (imagePath) => bucket().getPublicUrl(imagePath).data.publicUrl;

export async function uploadImage({ buffer, mimeType, extension }) {
  await ensureStorage();
  const imagePath = `${UPLOAD_DIR}/${Date.now()}-${randomUUID()}.${extension}`;
  const { error } = await bucket().upload(imagePath, buffer, {
    contentType: mimeType,
    cacheControl: '31536000',
    upsert: false,
  });
  if (error) {
    console.error('Image upload failed:', error.message);
    throw new HttpError(502, 'Image upload failed. Please try again.');
  }
  return { path: imagePath, url: imageUrl(imagePath) };
}

/** Best-effort delete; refuses anything outside uploads/ (path-traversal guard). */
export async function deleteImage(imagePath) {
  if (typeof imagePath !== 'string' || !IMAGE_PATH_PATTERN.test(imagePath) || imagePath.includes('..')) return;
  const { error } = await bucket().remove([imagePath]);
  if (error) console.error(`Could not delete ${imagePath}:`, error.message);
}
