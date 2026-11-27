import { once } from 'node:events';
import { createServer } from 'node:http';
import express from 'express';
import mongoose from 'mongoose';
import { attachReviewSocket } from './review-socket.js';
import { reviewsRouter } from './routes/reviews.js';

const port = Number(process.env.PORT ?? 3000);
const mongoUri = process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/live_reviews';

const app = express();
const server = createServer(app);
const sockets = attachReviewSocket(server);

app.disable('x-powered-by');
app.use('/api', (_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
app.use(express.json());
app.use('/api/reviews', reviewsRouter(sockets.broadcast));
app.use((_req, res) => res.status(404).json({ error: 'Route not found.' }));
app.use((error, _req, res, next) => {
  if (res.headersSent) return next(error);

  const status = error.status ?? 500;
  if (status >= 500) console.error('Request failed:', error.message);

  const messages = {
    'entity.parse.failed': 'Invalid JSON request body.',
    'entity.too.large': 'Request body is too large.',
  };
  const message = status >= 500 ? 'Internal server error.' : messages[error.type] ?? error.message;
  res.status(status).json({ error: message });
});

try {
  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5_000 });
  console.log('Connected to MongoDB.');
  server.listen(port);
  await once(server, 'listening');
  console.log(`Live Reviews API listening on port ${server.address().port}.`);

  function shutdown() {
    sockets.close();
    server.close(async () => {
      try {
        await mongoose.disconnect();
      } catch (error) {
        console.error('MongoDB disconnect failed:', error.message);
        process.exitCode = 1;
      }
    });
  }

  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
} catch (error) {
  sockets.close();
  console.error('Startup failed:', error.message);
  await mongoose.disconnect();
  process.exitCode = 1;
}
