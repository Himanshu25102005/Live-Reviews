import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { test } from 'node:test';
import express from 'express';
import { WebSocket } from 'ws';
import { Review } from '../src/models/review.js';
import { attachReviewSocket } from '../src/review-socket.js';
import { reviewsRouter } from '../src/routes/reviews.js';

test('review API and broadcasts with isolated storage', async (t) => {
  const data = new Map();
  let timestamp = Date.UTC(2026, 0, 1);
  let beforeRestore;
  let restoreError;

  t.mock.method(Review, 'create', async (input, options) => {
    if (Array.isArray(input)) {
      assert.deepEqual(options, { timestamps: false });
      await beforeRestore?.();
      if (restoreError) throw restoreError;
      const review = new Review(input[0]);
      if (data.has(review.id)) throw Object.assign(new Error('Duplicate ID'), { code: 11000 });
      data.set(review.id, review);
      return [review];
    }
    const createdAt = new Date(timestamp++);
    const review = new Review({ ...input, createdAt, updatedAt: createdAt });
    data.set(review.id, review);
    return review;
  });
  t.mock.method(Review, 'find', () => ({
    sort(order) {
      assert.deepEqual(order, { createdAt: -1, _id: -1 });
      return [...data.values()].sort((a, b) => b.createdAt - a.createdAt);
    },
  }));
  t.mock.method(Review, 'findById', async (id) => data.get(id));
  t.mock.method(Review, 'findByIdAndUpdate', async (id, update, options) => {
    const review = data.get(id);
    if (!review) return null;
    assert.deepEqual(options, { returnDocument: 'after', runValidators: true });
    review.set({ ...update.$set, updatedAt: new Date(timestamp++) });
    return review;
  });
  t.mock.method(Review, 'findByIdAndDelete', async (id) => {
    const review = data.get(id);
    data.delete(id);
    return review;
  });

  const app = express();
  const server = createServer(app);
  const socket = attachReviewSocket(server);
  app.use(express.json());
  app.use('/api/reviews', reviewsRouter(socket.broadcast));
  app.use((error, _req, res, _next) => res.status(error.status ?? 500).json({ error: error.message }));
  t.after(() => {
    socket.close();
    return new Promise((resolve) => server.close(resolve));
  });
  const listening = once(server, 'listening');
  server.listen(0, '127.0.0.1');
  await listening;
  const host = `127.0.0.1:${server.address().port}`;

  async function request(path, method = 'GET', body) {
    const response = await fetch(`http://${host}/api/reviews${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(3_000),
    });
    return {
      status: response.status,
      token: response.headers.get('X-Review-Undo-Token'),
      result: response.status === 204 ? await response.text() : await response.json(),
    };
  }

  const fields = { title: 'A title', content: 'Review content' };
  const clients = await Promise.all([1, 2].map(async () => {
    const client = new WebSocket(`ws://${host}/ws`);
    await once(client, 'open', { signal: AbortSignal.timeout(3_000) });
    return client;
  }));

  async function expectBroadcast(expected, mutation) {
    const messages = clients.map(async (client) => {
      const [message] = await once(client, 'message', { signal: AbortSignal.timeout(3_000) });
      return JSON.parse(message);
    });
    const [response, events] = await Promise.all([mutation(), Promise.all(messages)]);
    for (const event of events) assert.deepEqual(event, expected(response));
    return response;
  }

  let original;
  let path;
  let token;
  await t.test('create trims and returns the stored review to two WebSocket clients', async () => {
    const response = await expectBroadcast(
      ({ result }) => ({ type: 'review:created', review: result.data }),
      () => request('', 'POST', { title: ' A title  ', content: ' Review content ' }),
    );
    assert.equal(response.status, 201);
    original = response.result.data;
    path = `/${original.id}`;
    assert.match(original.id, /^[a-f\d]{24}$/);
    assert.equal(original.title, fields.title);
    assert.equal(original.content, fields.content);
    assert.equal(original.createdAt, original.updatedAt);
  });

  await t.test('rejects empty titles and content on create and update', async () => {
    for (const body of [{ ...fields, title: ' ' }, { ...fields, content: '' }]) {
      for (const response of [await request('', 'POST', body), await request(path, 'PUT', body)]) {
        assert.equal(response.status, 400);
        assert.deepEqual(response.result, { error: 'Title and content are required.' });
      }
    }
    assert.equal(data.size, 1);
  });

  await t.test('lists newest first and retrieves by ID', async () => {
    const second = await request('', 'POST', { ...fields, title: 'Newer' });
    assert.deepEqual((await request('')).result.data, [second.result.data, original]);
    assert.deepEqual((await request(path)).result.data, original);
  });

  await t.test('invalid and nonexistent IDs retain their status codes', async () => {
    for (const method of ['GET', 'PUT', 'DELETE']) {
      const body = method === 'PUT' ? fields : undefined;
      assert.equal((await request('/invalid-id', method, body)).status, 400);
      assert.equal((await request('/000000000000000000000000', method, body)).status, 404);
    }
  });

  await t.test('update sends the saved review and preserves its creation timestamp', async () => {
    const response = await expectBroadcast(
      ({ result }) => ({ type: 'review:updated', review: result.data }),
      () => request(path, 'PUT', { ...fields, content: 'Updated' }),
    );
    assert.equal(response.status, 200);
    assert.equal(response.result.data.createdAt, original.createdAt);
    assert.notEqual(response.result.data.updatedAt, original.updatedAt);
    assert.equal(response.result.data.content, 'Updated');
    original = response.result.data;
  });

  await t.test('delete removes persistent data, returns 204, and broadcasts the deleted snapshot', async () => {
    const response = await expectBroadcast(
      () => ({ type: 'review:deleted', id: original.id, review: original }),
      () => request(path, 'DELETE'),
    );
    assert.equal(response.status, 204);
    assert.equal(response.result, '');
    assert.ok(response.token);
    token = response.token;
    assert.equal((await request(path)).status, 404);
  });

  await t.test('restore is single-use and preserves all fields while broadcasting creation', async () => {
    assert.equal((await request(`${path}/restore`, 'POST', { token: 'invalid' })).status, 410);
    assert.equal((await request('/000000000000000000000000/restore', 'POST', { token })).status, 410);
    const response = await expectBroadcast(
      () => ({ type: 'review:created', review: original, restored: true }),
      () => request(`${path}/restore`, 'POST', { token }),
    );
    assert.equal(response.status, 201);
    assert.deepEqual(response.result.data, original);
    assert.deepEqual((await request(path)).result.data, original);
    assert.equal((await request(`${path}/restore`, 'POST', { token })).status, 410);
    assert.equal(data.size, 2);
  });

  await t.test('concurrent restore requests cannot insert duplicates', async () => {
    const { token } = await request(path, 'DELETE');
    const gate = Promise.withResolvers();
    const restoring = Promise.withResolvers();
    beforeRestore = () => {
      restoring.resolve();
      return gate.promise;
    };
    const first = request(`${path}/restore`, 'POST', { token });
    try {
      await Promise.race([restoring.promise, first.then(() => {
        throw new Error('Restore completed before reaching storage.');
      })]);
      assert.equal((await request(`${path}/restore`, 'POST', { token })).status, 409);
    } finally {
      beforeRestore = undefined;
      gate.resolve();
      assert.equal((await first).status, 201);
    }
    assert.equal(data.size, 2);
  });

  await t.test('a storage failure returns an error and permits an unexpired retry', async () => {
    const { token } = await request(path, 'DELETE');
    restoreError = new Error('Storage failed');
    try {
      assert.equal((await request(`${path}/restore`, 'POST', { token })).status, 500);
      assert.equal((await request(path)).status, 404);
    } finally {
      restoreError = undefined;
    }
    assert.equal((await request(`${path}/restore`, 'POST', { token })).status, 201);
  });

  await t.test('expired receipts cannot recreate a review', async (st) => {
    const time = Date.now();
    const { token } = await request(path, 'DELETE');
    st.mock.method(Date, 'now', () => time + 31_000);
    assert.equal((await request(`${path}/restore`, 'POST', { token })).status, 410);
    assert.equal((await request(path)).status, 404);
  });
});
