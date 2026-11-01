// Local development server. In production the same handlers run as Vercel functions (see /api).
import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import bannerById from '../api/banners/[id].js';
import banners from '../api/banners/index.js';
import footer from '../api/footer.js';
import uploads from '../api/uploads.js';
import login from '../api/auth/login.js';
import logout from '../api/auth/logout.js';
import me from '../api/auth/me.js';

const app = express();
const port = Number(process.env.PORT) || 5000;
const allowedOrigins = [process.env.APP_URL, 'http://localhost:5173', 'http://127.0.0.1:5173'].filter(Boolean);

app.disable('x-powered-by');
app.use(cors({ origin: allowedOrigins, credentials: true }));

// Handlers parse their own bodies (JSON and multipart), so no body-parser middleware is mounted.
const withId = (handler) => (req, res) => {
  // Express 5 exposes req.query as a getter; shadow it so handlers see Vercel's req.query.id shape.
  Object.defineProperty(req, 'query', { value: { ...req.query, id: req.params.id }, configurable: true });
  return handler(req, res);
};

app.all('/api/banners', banners);
app.all('/api/banners/:id', withId(bannerById));
app.all('/api/uploads', uploads);
app.all('/api/footer', footer);
app.all('/api/auth/login', login);
app.all('/api/auth/logout', logout);
app.all('/api/auth/me', me);
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));

app.listen(port, () => console.log(`Tour API listening on http://localhost:${port}`));
