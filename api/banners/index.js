import { requireAdmin } from '../../server/lib/auth.js';
import { createBanner, listBanners } from '../../server/lib/bannerService.js';
import { readJson, route, sendJson } from '../../server/lib/http.js';

export default route({
  GET: async (req, res) => sendJson(res, 200, await listBanners()),
  POST: async (req, res) => {
    requireAdmin(req);
    sendJson(res, 201, await createBanner(await readJson(req)));
  },
});
