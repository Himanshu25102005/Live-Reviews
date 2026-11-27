import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyReviewEvent, highlightDuration, recordReviewHighlight, reviewRows } from '../src/review-events.js';
import { selectReviews } from '../src/review-list.js';
import { undoDuration, undoReview } from '../src/review-undo.js';
import { createTimedEntries } from '../src/timed-entries.js';

const zebra = { id: '1', title: 'zebra', content: 'Common text', createdAt: '2026-01-01T00:00:00Z' };
const apple = { id: '2', title: 'Apple', content: 'Second common text', createdAt: '2026-01-03T00:00:00Z' };
const berry = { id: '3', title: 'Berry', content: 'Other text', createdAt: '2026-01-02T00:00:00Z' };
const sample = Object.freeze([zebra, apple, berry]);
const titles = (reviews) => reviews.map(({ title }) => title);

test('search matches case-insensitive substrings in either field and handles empty queries', () => {
  assert.deepEqual(titles(selectReviews(sample, '  ZEBr ', 'newest')), ['zebra']);
  assert.deepEqual(titles(selectReviews(sample, ' CoMmOn ', 'newest')), ['Apple', 'zebra']);
  assert.deepEqual(selectReviews(sample, 'missing', 'newest'), []);
  assert.equal(selectReviews(sample, '   ', 'newest').length, 3);
});

for (const [sort, expected] of Object.entries({
  titleAsc: ['Apple', 'Berry', 'zebra'],
  titleDesc: ['zebra', 'Berry', 'Apple'],
  oldest: ['zebra', 'Berry', 'Apple'],
  newest: ['Apple', 'Berry', 'zebra'],
})) {
  test(`${sort} orders a copy and also works with search`, () => {
    assert.deepEqual(titles(selectReviews(sample, '', sort)), expected);
    assert.deepEqual(titles(selectReviews(sample, 'common', sort)), expected.filter((title) => title !== 'Berry'));
    assert.deepEqual(titles(sample), ['zebra', 'Apple', 'Berry']);
  });
}

function setUpHighlights(t, initial) {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 0 });
  let entries = new Map();
  let reviews = initial;
  const highlights = createTimedEntries(highlightDuration, (next) => { entries = next; });
  return {
    event(event) {
      reviews = applyReviewEvent(reviews, event);
      recordReviewHighlight(event, highlights);
    },
    rows: () => reviewRows(reviews, entries),
    clear: highlights.clear,
  };
}

for (const kind of ['created', 'updated', 'deleted']) {
  test(`${kind} highlights for 3,000ms with the correct row lifetime`, (t) => {
    const display = setUpHighlights(t, kind === 'created' ? [] : [zebra]);
    const changed = { ...zebra, content: 'Current text' };
    display.event({ type: `review:${kind}`, id: zebra.id, review: changed });
    assert.equal(display.rows()[0].content, changed.content);
    assert.equal(display.rows()[0].highlight, kind);
    t.mock.timers.tick(2_999);
    assert.equal(display.rows()[0].highlight, kind);
    t.mock.timers.tick(1);
    assert.equal(display.rows().length, kind === 'deleted' ? 0 : 1);
    assert.equal(display.rows()[0]?.highlight, undefined);
  });
}

test('repeated events replace the timer for one review and leave other reviews independent', (t) => {
  const display = setUpHighlights(t, []);
  display.event({ type: 'review:created', review: zebra });
  display.event({ type: 'review:created', review: apple });
  t.mock.timers.tick(2_000);
  display.event({ type: 'review:updated', review: { ...zebra, content: 'Changed' } });
  t.mock.timers.tick(1_000);
  assert.equal(display.rows().find(({ id }) => id === apple.id).highlight, undefined);
  assert.equal(display.rows().find(({ id }) => id === zebra.id).highlight, 'updated');
  t.mock.timers.tick(2_000);
  assert.equal(display.rows().find(({ id }) => id === zebra.id).highlight, undefined);
});

test('restoration removes the red highlight and does not schedule a green one', (t) => {
  const display = setUpHighlights(t, [zebra]);
  display.event({ type: 'review:deleted', id: zebra.id, review: zebra });
  assert.equal(display.rows()[0].highlight, 'deleted');
  display.event({ type: 'review:created', review: zebra, restored: true });
  assert.deepEqual(display.rows(), [{ ...zebra, highlight: undefined }]);
  t.mock.timers.tick(3_000);
  assert.equal(display.rows().length, 1);
});

test('reconnect data takes precedence over a retained deleted row', () => {
  const highlights = new Map([[zebra.id, { kind: 'deleted', review: zebra }]]);
  assert.deepEqual(reviewRows([{ ...zebra, content: 'Restored' }], highlights), [
    { ...zebra, content: 'Restored', highlight: undefined },
  ]);
});

test('unmount cleanup cancels all outstanding timers', (t) => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 0 });
  const publish = t.mock.fn();
  const entries = createTimedEntries(highlightDuration, publish);
  entries.set(zebra.id, zebra);
  entries.set(apple.id, apple);
  entries.clear();
  t.mock.timers.tick(10_000);
  assert.equal(publish.mock.callCount(), 2);
  assert.equal(entries.take(zebra.id), undefined);
});

test('Undo remains available until 5,000ms independently for each deletion', (t) => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 0 });
  let visible;
  const deletions = createTimedEntries(undoDuration, (next) => { visible = next; });
  deletions.set('first', zebra);
  t.mock.timers.tick(1_000);
  deletions.set('second', apple);
  t.mock.timers.tick(3_999);
  assert.deepEqual([...visible.keys()], ['first', 'second']);
  t.mock.timers.tick(1);
  assert.deepEqual([...visible.keys()], ['second']);
  assert.equal(deletions.take('first'), undefined);
  t.mock.timers.tick(1_000);
  assert.equal(visible.size, 0);
});

test('a late-window Undo posts the correct receipt once even when clicked twice', async (t) => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 0 });
  const deletions = createTimedEntries(undoDuration, () => {});
  const fetch = t.mock.method(globalThis, 'fetch', async (path, options) => {
    assert.equal(path, '/api/reviews/1/restore');
    assert.equal(options.method, 'POST');
    assert.deepEqual(JSON.parse(options.body), { token: 'receipt' });
    return Response.json({ data: zebra }, { status: 201 });
  });
  deletions.set('receipt', zebra);
  t.mock.timers.tick(4_999);
  assert.deepEqual(await Promise.all([undoReview(deletions.take, 'receipt'), undoReview(deletions.take, 'receipt')]), [zebra, undefined]);
  assert.equal(fetch.mock.callCount(), 1);
});

test('Undo rejects an expired click even when its timer callback has not run', async (t) => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 0 });
  const deletions = createTimedEntries(undoDuration, () => {});
  const fetch = t.mock.method(globalThis, 'fetch');
  deletions.set('receipt', zebra);
  t.mock.timers.setTime(5_000);
  assert.equal(await undoReview(deletions.take, 'receipt'), undefined);
  assert.equal(fetch.mock.callCount(), 0);
});

test('Undo surfaces a restore failure', async (t) => {
  const deletions = createTimedEntries(undoDuration, () => {});
  deletions.set('receipt', zebra);
  t.mock.method(globalThis, 'fetch', async () => Response.json({ error: 'Restore rejected.' }, { status: 410 }));
  await assert.rejects(undoReview(deletions.take, 'receipt'), /Restore rejected/);
});
