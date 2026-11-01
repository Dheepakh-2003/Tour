/** Thin service layer over the Tour REST API. */
import { prepareImage, sizeProblem } from '../utils/image.js';

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(`/api${path}`, { credentials: 'same-origin', ...options });
  } catch {
    throw new ApiError('Cannot reach the server. Check your connection and try again.', 0);
  }
  let body = null;
  try {
    body = await response.json();
  } catch {
    // Non-JSON response (e.g. the platform returned an error page).
  }
  if (!response.ok) throw new ApiError(body?.error || `Request failed (${response.status}).`, response.status);
  return body;
}

const jsonRequest = (method, body) => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

/** Banner payload: { header, description, images: [uploadPath, ...] } */
export const bannerApi = {
  list: () => request('/banners'),
  create: (data) => request('/banners', jsonRequest('POST', data)),
  update: (id, data) => request(`/banners/${id}`, jsonRequest('PUT', data)),
  remove: (id) => request(`/banners/${id}`, { method: 'DELETE' }),
};

/** Footer payload: { name, imagePath } */
export const footerApi = {
  get: () => request('/footer'),
  save: (data) => request('/footer', jsonRequest('PUT', data)),
};

export const uploadApi = {
  /** Uploads one image (shrunk in the browser first). Resolves to { path, url }. */
  async upload(file, options) {
    const prepared = await prepareImage(file, options);
    const problem = sizeProblem(prepared);
    if (problem) throw new ApiError(problem, 413);
    const form = new FormData();
    form.append('image', prepared);
    return request('/uploads', { method: 'POST', body: form });
  },
  /** Removes an upload that was never saved to a banner/footer. Failures are not important. */
  discard: (path) => request('/uploads', jsonRequest('DELETE', { path })).catch(() => {}),
};

export const authApi = {
  me: () => request('/auth/me'),
  login: (password) => request('/auth/login', jsonRequest('POST', { password })),
  logout: () => request('/auth/logout', { method: 'POST' }),
};
