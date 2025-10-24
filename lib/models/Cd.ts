import { models, model, Schema, Types, type InferSchemaType } from 'mongoose';
import { applyUniqueSlug } from '@/lib/models/plugins/uniqueSlug';
import { applyStatusFields } from '@/lib/models/plugins/status';

const CdSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    company: String,
    release_date: String,
    info: String,
    slug: { type: String, unique: true, index: true },
    cover: { type: Types.ObjectId, ref: 'UploadFile' },
    track: [{ type: Types.ObjectId, ref: 'CdTrack' }],
    published_at: { type: Date, default: null },
    created_by: { type: Types.ObjectId, ref: 'Admin' },
    updated_by: { type: Types.ObjectId, ref: 'Admin' }
  },
  { timestamps: true }
);

applyStatusFields(CdSchema);
applyUniqueSlug(CdSchema);

CdSchema.index({ title: 'text', company: 'text' });

export type Cd = InferSchemaType<typeof CdSchema>;

export default models.Cd || model('Cd', CdSchema);
