import { StorageClient } from '@supabase/storage-js';
import { bucketName, requireEnv } from './config.js';

let client;

/**
 * Service-role Storage client. Server-side only — the key must never reach the browser.
 * Uses storage-js directly (not the full supabase-js) since only Storage is needed.
 */
export function storage() {
  if (!client) {
    const key = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
    const url = requireEnv('SUPABASE_URL').replace(/\/+$/, '');
    client = new StorageClient(`${url}/storage/v1`, { apikey: key, Authorization: `Bearer ${key}` });
  }
  return client;
}

export const bucket = () => storage().from(bucketName());

/**
 * Reads an object's text with the CDN cache bypassed (cache-busting query + no-cache headers).
 * banners.json is rewritten often, and a stale read inside the write lock could drop a banner.
 * Returns null when the object does not exist.
 */
export async function fetchObjectText(path) {
  const key = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  const url = requireEnv('SUPABASE_URL').replace(/\/+$/, '');
  const response = await fetch(`${url}/storage/v1/object/${encodeURIComponent(bucketName())}/${path}?t=${Date.now()}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Cache-Control': 'no-cache' },
    cache: 'no-store',
  });
  if (response.status === 400 || response.status === 404) return null;
  if (!response.ok) throw new Error(`Storage read failed (${response.status}) for ${path}`);
  return response.text();
}
