import { models, model, Schema, Types, type InferSchemaType } from 'mongoose';
import { applyStatusFields } from '@/lib/models/plugins/status';

const MessageSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    message: { type: String, required: true },
    response: { type: String },
    private: { type: Boolean, default: true },
    published_at: { type: Date, default: null },
    created_by: { type: Types.ObjectId, ref: 'Admin' },
    updated_by: { type: Types.ObjectId, ref: 'Admin' }
  },
  { timestamps: true }
);

applyStatusFields(MessageSchema);

MessageSchema.index({
  name: 'text',
  email: 'text',
  city: 'text',
  state: 'text',
  message: 'text',
  response: 'text'
});

export type Message = InferSchemaType<typeof MessageSchema>;

export default models.Message || model('Message', MessageSchema);
