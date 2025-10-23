import { models, model, Schema, Types, type InferSchemaType } from 'mongoose';
import { applyUniqueSlug } from '@/lib/models/plugins/uniqueSlug';

const ShowSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, unique: true, index: true },
    date: { type: Date, required: true },
    time: String,
    venue: { type: String, required: true },
    city: { type: String, required: true },
    state: String,
    country: String,
    address: String,
    ticket_url: String,
    description: String,
    cover: { type: Types.ObjectId, ref: 'UploadFile' },
    published_at: { type: Date, default: null },
    created_by: { type: Types.ObjectId, ref: 'Admin' },
    updated_by: { type: Types.ObjectId, ref: 'Admin' }
  },
  { timestamps: true }
);

applyUniqueSlug(ShowSchema);

ShowSchema.index({ title: 'text', venue: 'text', city: 'text', state: 'text', country: 'text' });

export type Show = InferSchemaType<typeof ShowSchema>;

export default models.Show || model('Show', ShowSchema);
