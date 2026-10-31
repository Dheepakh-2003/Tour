import { randomUUID } from 'node:crypto';
import { DATA_PATH, LOCK_PATH, UPLOAD_DIR, bucketName } from './config.js';
import { HttpError } from './errors.js';
import { bucket, fetchObjectText, storage } from './supabase.js';

const LOCK_STALE_MS = 20_000;
const LOCK_TIMEOUT_MS = 12_000;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let ready = false;
let readyPromise = null;

const isAlreadyExists = (error) =>
  String(error?.statusCode) === '409' || /already exists|duplicate/i.test(error?.message || '');

/** Creates the bucket and an empty banners.json when they do not exist yet. */
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
    const { data: files, error } = await bucket().list('data', { search: 'banners.json' });
    if (error) throw new Error(`Cannot list data folder: ${error.message}`);
    if (!files.some((f) => f.name === 'banners.json')) {
      const { error: createError } = await bucket().upload(DATA_PATH, '[]', {
        contentType: 'application/json',
        cacheControl: '0',
        upsert: false,
      });
      if (createError && !isAlreadyExists(createError)) throw new Error(`Cannot create banners.json: ${createError.message}`);
    }
    ready = true;
  })().finally(() => {
    readyPromise = null;
  });
  await readyPromise;
}

async function downloadBanners() {
  const text = await fetchObjectText(DATA_PATH);
  if (text === null) throw new Error('Cannot read banners.json: not found');
  const parsed = JSON.parse(text);
  if (!Array.isArray(parsed)) throw new Error('banners.json is corrupted: expected an array.');
  return parsed;
}

/** Reads all banners (oldest first). Never silently treats a read failure as "empty". */
export async function readBanners() {
  await ensureStorage();
  try {
    return await downloadBanners();
  } catch (firstError) {
    // The file may have been removed while this instance was warm: re-check once.
    await ensureStorage(true);
    try {
      return await downloadBanners();
    } catch {
      throw firstError;
    }
  }
}

async function writeBanners(banners) {
  const { error } = await bucket().upload(DATA_PATH, JSON.stringify(banners, null, 2), {
    contentType: 'application/json',
    cacheControl: '0',
    upsert: true,
  });
  if (error) throw new Error(`Cannot write banners.json: ${error.message}`);
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
 * Runs `mutator(banners)` under an exclusive lock and saves the array it returns.
 * The mutator returns `{ banners, result }`; `result` is passed back to the caller.
 */
export function updateBanners(mutator) {
  const run = async () => {
    await ensureStorage();
    await acquireLock();
    try {
      const current = await downloadBanners();
      const { banners, result } = await mutator(current);
      await writeBanners(banners);
      return result;
    } finally {
      await bucket().remove([LOCK_PATH]).catch(() => {});
    }
  };
  const next = queue.then(run, run);
  queue = next.catch(() => {});
  return next;
}

/* ------------------------------ images ------------------------------ */

const SAFE_IMAGE_PATH = /^uploads\/[A-Za-z0-9._-]+$/;

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
  return { imagePath, imageUrl: bucket().getPublicUrl(imagePath).data.publicUrl };
}

/** Best-effort delete; refuses anything outside uploads/ (path-traversal guard). */
export async function deleteImage(imagePath) {
  if (typeof imagePath !== 'string' || !SAFE_IMAGE_PATH.test(imagePath) || imagePath.includes('..')) return;
  const { error } = await bucket().remove([imagePath]);
  if (error) console.error(`Could not delete ${imagePath}:`, error.message);
}
