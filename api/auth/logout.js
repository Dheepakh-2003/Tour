import { endSession } from '../../server/lib/auth.js';
import { route, sendJson } from '../../server/lib/http.js';

export default route({
  POST: async (req, res) => {
    endSession(res);
    sendJson(res, 200, { authenticated: false });
  },
});
