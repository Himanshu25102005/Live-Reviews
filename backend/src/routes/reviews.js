import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import mongoose from 'mongoose';
import { Review } from '../models/review.js';

// Allow network transit after a click near the end of the five-second browser window.
const receiptLifetime = 30_000;

function reviewFields(body) {
  const title = typeof body?.title === 'string' ? body.title.trim() : '';
  const content = typeof body?.content === 'string' ? body.content.trim() : '';

  if (!title || !content) {
    throw Object.assign(new Error('Title and content are required.'), { status: 400 });
  }
  return { title, content };
}

function requireReview(review) {
  if (!review) {
    throw Object.assign(new Error('Review not found.'), { status: 404 });
  }
  return review;
}

export function reviewsRouter(broadcast) {
  const router = Router();
  const deletions = new Map();

  router.param('id', (_req, _res, next, id) => {
    if (!mongoose.isObjectIdOrHexString(id)) {
      return next(Object.assign(new Error('Invalid review ID.'), { status: 400 }));
    }
    next();
  });

  router.get('/', async (_req, res) => {
    const reviews = await Review.find().sort({ createdAt: -1, _id: -1 });
    res.json({ data: reviews });
  });

  router.get('/:id', async (req, res) => {
    const review = requireReview(await Review.findById(req.params.id));
    res.json({ data: review });
  });

  router.post('/', async (req, res) => {
    const review = await Review.create(reviewFields(req.body));
    broadcast({ type: 'review:created', review });
    res.status(201).location(`/api/reviews/${review.id}`).json({ data: review });
  });

  router.put('/:id', async (req, res) => {
    const review = requireReview(await Review.findByIdAndUpdate(
      req.params.id,
      { $set: reviewFields(req.body) },
      { returnDocument: 'after', runValidators: true },
    ));
    broadcast({ type: 'review:updated', review });
    res.json({ data: review });
  });

  router.delete('/:id', async (req, res) => {
    const review = requireReview(await Review.findByIdAndDelete(req.params.id));
    const token = randomUUID();
    const receipt = { review: review.toJSON(), expiresAt: Date.now() + receiptLifetime };
    receipt.timer = setTimeout(() => deletions.delete(token), receiptLifetime).unref();
    deletions.set(token, receipt);
    broadcast({ type: 'review:deleted', id: review.id, review });
    res.set('X-Review-Undo-Token', token).status(204).end();
  });

  router.post('/:id/restore', async (req, res) => {
    const { token } = req.body ?? {};
    const receipt = deletions.get(token);
    if (!receipt || receipt.review.id !== req.params.id.toLowerCase() || Date.now() >= receipt.expiresAt) {
      return res.status(410).json({ error: 'This deletion can no longer be undone.' });
    }
    if (receipt.restoring) {
      return res.status(409).json({ error: 'This review is already being restored.' });
    }

    receipt.restoring = true;
    const { id, ...fields } = receipt.review;
    let review;
    try {
      [review] = await Review.create([{ _id: id, ...fields }], { timestamps: false });
    } catch (error) {
      receipt.restoring = false;
      if (error.code === 11000) {
        return res.status(409).json({ error: 'This review already exists.' });
      }
      throw error;
    }

    clearTimeout(receipt.timer);
    deletions.delete(token);
    broadcast({ type: 'review:created', review, restored: true });
    res.status(201).location(`/api/reviews/${id}`).json({ data: review });
  });

  return router;
}
