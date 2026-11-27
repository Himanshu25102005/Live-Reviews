import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  content: { type: String, required: true, trim: true },
}, {
  timestamps: true,
  toJSON: {
    transform(_document, { _id, title, content, createdAt, updatedAt }) {
      return { id: _id.toString(), title, content, createdAt, updatedAt };
    },
  },
});

reviewSchema.index({ createdAt: -1, _id: -1 });

export const Review = mongoose.model('Review', reviewSchema);
