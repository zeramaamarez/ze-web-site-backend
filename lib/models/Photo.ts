import { models, model, Schema, Types, type InferSchemaType } from 'mongoose';
import { applyUniqueSlug } from '@/lib/models/plugins/uniqueSlug';
import { applyStatusFields } from '@/lib/models/plugins/status';

const PhotoSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, unique: true, index: true },
    images: [{ type: Types.ObjectId, ref: 'UploadFile' }],
    description: String,
    date: String,
    location: String,
    published_at: { type: Date, default: null },
    created_by: { type: Types.ObjectId, ref: 'Admin' },
    updated_by: { type: Types.ObjectId, ref: 'Admin' }
  },
  {
    timestamps: true,
    collection: 'components_photo_photos'
  }
);

applyStatusFields(PhotoSchema);
applyUniqueSlug(PhotoSchema);

PhotoSchema.index({ title: 'text', description: 'text', location: 'text' });

export type Photo = InferSchemaType<typeof PhotoSchema>;

export default models.Photo || model('Photo', PhotoSchema);
