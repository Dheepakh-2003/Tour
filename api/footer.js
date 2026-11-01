import { requireAdmin } from '../server/lib/auth.js';
import { getFooter, saveFooter } from '../server/lib/footerService.js';
import { readJson, route, sendJson } from '../server/lib/http.js';

export default route({
  GET: async (req, res) => sendJson(res, 200, await getFooter()),
  PUT: async (req, res) => {
    requireAdmin(req);
    sendJson(res, 200, await saveFooter(await readJson(req)));
  },
});
