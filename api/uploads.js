import { requireAdmin } from '../server/lib/auth.js';
import { readJson, readPayload, route, sendJson } from '../server/lib/http.js';
import { createUpload, discardUpload } from '../server/lib/uploadService.js';

export default route({
  POST: async (req, res) => {
    requireAdmin(req);
    const { file } = await readPayload(req);
    sendJson(res, 201, await createUpload(file));
  },
  DELETE: async (req, res) => {
    requireAdmin(req);
    const { path } = await readJson(req);
    await discardUpload(path);
    sendJson(res, 200, { ok: true });
  },
});
