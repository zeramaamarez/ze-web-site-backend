import { models, model, Schema, Types, type InferSchemaType } from 'mongoose';
import { applyUniqueSlug } from '@/lib/models/plugins/uniqueSlug';

const DvdTrackRefSchema = new Schema(
  {
    ref: { type: Types.ObjectId, ref: 'DvdTrack', required: true },
    kind: { type: String, default: 'ComponentDvdTrack' }
  },
  { _id: false }
);

const DvdSchema = new Schema(
  {
    title: { type: String, required: true },
    company: String,
    release_date: String,
    info: String,
    videoUrl: String,
    slug: { type: String, unique: true, index: true },
    cover: { type: Types.ObjectId, ref: 'UploadFile' },
    track: [DvdTrackRefSchema],
    published_at: { type: Date, default: null },
    created_by: { type: Types.ObjectId, ref: 'Admin' },
    updated_by: { type: Types.ObjectId, ref: 'Admin' }
  },
  { timestamps: true }
);

applyUniqueSlug(DvdSchema);

DvdSchema.index({ title: 'text', company: 'text' });

export type Dvd = InferSchemaType<typeof DvdSchema>;

export default models.Dvd || model('Dvd', DvdSchema);
