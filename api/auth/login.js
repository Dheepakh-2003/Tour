import { startSession, verifyPassword } from '../../server/lib/auth.js';
import { HttpError } from '../../server/lib/errors.js';
import { clientIp, readJson, route, sendJson } from '../../server/lib/http.js';

// Best-effort brute-force throttle (per server instance).
const attempts = new Map();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 8;

export default route({
  POST: async (req, res) => {
    const ip = clientIp(req);
    const now = Date.now();
    const entry = attempts.get(ip);
    if (entry && now - entry.since < WINDOW_MS && entry.count >= MAX_FAILURES) {
      throw new HttpError(429, 'Too many failed attempts. Try again later.');
    }

    const { password } = await readJson(req);
    if (typeof password !== 'string' || !password || password.length > 200) {
      throw new HttpError(400, 'Password is required.');
    }
    if (!verifyPassword(password)) {
      const fresh = entry && now - entry.since < WINDOW_MS ? entry : { since: now, count: 0 };
      attempts.set(ip, { since: fresh.since, count: fresh.count + 1 });
      throw new HttpError(401, 'Incorrect password.');
    }
    attempts.delete(ip);
    startSession(res);
    sendJson(res, 200, { authenticated: true });
  },
});
