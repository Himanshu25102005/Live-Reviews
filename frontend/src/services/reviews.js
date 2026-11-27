const resource = '/api/reviews';

async function request(path, { method = 'GET', body, signal } = {}) {
  let response;
  try {
    response = await fetch(path, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new Error('Could not reach the reviews server. Please try again.');
  }

  if (response.status === 204) return response.headers.get('X-Review-Undo-Token');

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error ?? 'The server could not complete the request. Please try again.');
  }
  if (!payload || !Object.hasOwn(payload, 'data')) {
    throw new Error('The server returned an unexpected response. Please try again.');
  }
  return payload.data;
}

const reviewPath = (id) => `${resource}/${encodeURIComponent(id)}`;

export const reviewsApi = {
  list: (signal) => request(resource, { signal }),
  get: (id, signal) => request(reviewPath(id), { signal }),
  create: (body) => request(resource, { method: 'POST', body }),
  update: (id, body) => request(reviewPath(id), { method: 'PUT', body }),
  remove: (id) => request(reviewPath(id), { method: 'DELETE' }),
  restore: (id, token) => request(`${reviewPath(id)}/restore`, { method: 'POST', body: { token } }),
};
