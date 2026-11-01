import { requireAdmin } from '../../server/lib/auth.js';
import { deleteBanner, getBanner, updateBanner } from '../../server/lib/bannerService.js';
import { readJson, route, sendJson } from '../../server/lib/http.js';

export default route({
  GET: async (req, res) => sendJson(res, 200, await getBanner(req.query.id)),
  PUT: async (req, res) => {
    requireAdmin(req);
    sendJson(res, 200, await updateBanner(req.query.id, await readJson(req)));
  },
  DELETE: async (req, res) => {
    requireAdmin(req);
    await deleteBanner(req.query.id);
    sendJson(res, 200, { ok: true });
  },
});
