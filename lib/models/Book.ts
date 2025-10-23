import { models, model, Schema, Types, type InferSchemaType } from 'mongoose';
import { applyUniqueSlug } from '@/lib/models/plugins/uniqueSlug';

const BookSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    author: String,
    info: String,
    publishing_company: String,
    release_date: String,
    ISBN: { type: String, index: true },
    slug: { type: String, unique: true, index: true },
    cover: { type: Types.ObjectId, ref: 'UploadFile' },
    published_at: { type: Date, default: null },
    created_by: { type: Types.ObjectId, ref: 'Admin' },
    updated_by: { type: Types.ObjectId, ref: 'Admin' }
  },
  { timestamps: true }
);

applyUniqueSlug(BookSchema);

BookSchema.index({ title: 'text', author: 'text', ISBN: 'text' });

export type Book = InferSchemaType<typeof BookSchema>;

export default models.Book || model('Book', BookSchema);
