import { models, model, Schema, Types, type InferSchemaType } from 'mongoose';

const MessageSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    message: { type: String, required: true },
    response: { type: String, default: '' },
    publicada: { type: Boolean, default: false },
    created_by: { type: Types.ObjectId, ref: 'Admin' },
    updated_by: { type: Types.ObjectId, ref: 'Admin' }
  },
  { timestamps: true }
);

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
