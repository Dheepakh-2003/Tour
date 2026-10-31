import { isAdmin } from '../../server/lib/auth.js';
import { route, sendJson } from '../../server/lib/http.js';

export default route({
  GET: async (req, res) => sendJson(res, 200, { authenticated: isAdmin(req) }),
});
