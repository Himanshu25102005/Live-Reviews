import { Router } from 'express';
import mongoose from 'mongoose';
import { Review } from '../models/review.js';

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
    broadcast({ type: 'review:deleted', id: review.id });
    res.status(204).end();
  });

  return router;
}
