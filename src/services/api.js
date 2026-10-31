/** Thin service layer over the Tour REST API. */

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

function bannerFormData({ image, header, description }) {
  const form = new FormData();
  if (image) form.append('image', image);
  form.append('header', header);
  form.append('description', description);
  return form;
}

export const bannerApi = {
  list: () => request('/banners'),
  create: (data) => request('/banners', { method: 'POST', body: bannerFormData(data) }),
  update: (id, data) => request(`/banners/${id}`, { method: 'PUT', body: bannerFormData(data) }),
  remove: (id) => request(`/banners/${id}`, { method: 'DELETE' }),
};

export const authApi = {
  me: () => request('/auth/me'),
  login: (password) => request('/auth/login', jsonRequest('POST', { password })),
  logout: () => request('/auth/logout', { method: 'POST' }),
};
