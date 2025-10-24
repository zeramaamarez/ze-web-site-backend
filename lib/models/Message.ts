import { models, model, Schema, Types, type InferSchemaType } from 'mongoose';
import { applyUniqueSlug } from '@/lib/models/plugins/uniqueSlug';
import { applyStatusFields } from '@/lib/models/plugins/status';

const MessageSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, unique: true, index: true },
    content: { type: String, required: true },
    excerpt: String,
    cover: { type: Types.ObjectId, ref: 'UploadFile' },
    private: { type: Boolean, default: true },
    published_at: { type: Date, default: null },
    created_by: { type: Types.ObjectId, ref: 'Admin' },
    updated_by: { type: Types.ObjectId, ref: 'Admin' }
  },
  { timestamps: true }
);

applyStatusFields(MessageSchema);
applyUniqueSlug(MessageSchema);

MessageSchema.index({ title: 'text', content: 'text', excerpt: 'text' });

export type Message = InferSchemaType<typeof MessageSchema>;

export default models.Message || model('Message', MessageSchema);
