import Busboy from 'busboy';
import { MAX_IMAGE_BYTES } from './config.js';
import { HttpError } from './errors.js';

export function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

/**
 * Wraps a map of { METHOD: handler } into a single (req, res) function that works
 * unchanged under Express and Vercel: method dispatch, same-origin check for
 * state-changing requests (CSRF defence-in-depth), and uniform error handling.
 */
export function route(handlers) {
  return async (req, res) => {
    try {
      const handler = handlers[req.method];
      if (!handler) {
        res.setHeader('Allow', Object.keys(handlers).join(', '));
        throw new HttpError(405, 'Method not allowed.');
      }
      if (req.method !== 'GET') assertSameOrigin(req);
      await handler(req, res);
    } catch (error) {
      if (error instanceof HttpError) return sendJson(res, error.status, { error: error.message });
      console.error(error);
      sendJson(res, 500, { error: 'Something went wrong on the server.' });
    }
  };
}

function assertSameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  let originHost;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new HttpError(403, 'Invalid origin.');
  }
  if (originHost !== host) throw new HttpError(403, 'Cross-origin requests are not allowed.');
}

export const clientIp = (req) =>
  String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();

async function readStream(req, limit = 64 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new HttpError(413, 'Request body is too large.');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

/** Parses a JSON body (Vercel pre-parses it; Express leaves the raw stream). */
export async function readJson(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
  const raw = typeof req.body === 'string' ? req.body : await readStream(req);
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw new HttpError(400, 'Request body is not valid JSON.');
  }
}

function readMultipart(req) {
  return new Promise((resolve, reject) => {
    let busboy;
    try {
      busboy = Busboy({
        headers: req.headers,
        limits: { files: 1, fields: 10, fieldSize: 16 * 1024, fileSize: MAX_IMAGE_BYTES },
      });
    } catch {
      return reject(new HttpError(400, 'Malformed form data.'));
    }
    const fields = {};
    let file = null;
    let failure = null;

    busboy.on('field', (name, value) => {
      fields[name] = value;
    });
    busboy.on('file', (name, stream, info) => {
      if (name !== 'image' || !info.filename) return stream.resume();
      const chunks = [];
      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('limit', () => {
        failure = new HttpError(413, `Image must be smaller than ${MAX_IMAGE_BYTES / 1024 / 1024} MB.`);
      });
      stream.on('end', () => {
        file = { buffer: Buffer.concat(chunks), filename: info.filename, mimeType: info.mimeType };
      });
    });
    busboy.on('error', () => reject(new HttpError(400, 'Malformed form data.')));
    busboy.on('close', () => (failure ? reject(failure) : resolve({ fields, file })));
    req.pipe(busboy);
  });
}

/** Returns { fields, file } from either multipart/form-data or JSON. */
export async function readPayload(req) {
  const type = String(req.headers['content-type'] || '');
  if (type.startsWith('multipart/form-data')) return readMultipart(req);
  if (type.startsWith('application/json')) return { fields: await readJson(req), file: null };
  throw new HttpError(415, 'Unsupported content type.');
}
