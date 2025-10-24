import { models, model, Schema, Types, type InferSchemaType } from 'mongoose';
import { applyUniqueSlug } from '@/lib/models/plugins/uniqueSlug';
import { applyStatusFields } from '@/lib/models/plugins/status';

const DvdSchema = new Schema(
  {
    title: { type: String, required: true },
    company: String,
    release_date: String,
    info: String,
    videoUrl: String,
    slug: { type: String, unique: true, index: true },
    cover: { type: Types.ObjectId, ref: 'UploadFile' },
    track: [{ type: Types.ObjectId, ref: 'DvdTrack' }],
    published_at: { type: Date, default: null },
    created_by: { type: Types.ObjectId, ref: 'Admin' },
    updated_by: { type: Types.ObjectId, ref: 'Admin' }
  },
  { timestamps: true }
);

applyStatusFields(DvdSchema);
applyUniqueSlug(DvdSchema);

DvdSchema.index({ title: 'text', company: 'text' });

export type Dvd = InferSchemaType<typeof DvdSchema>;

export default models.Dvd || model('Dvd', DvdSchema);
