import { models, model, Schema, type InferSchemaType } from 'mongoose';

const AdminSchema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, index: true },
    password: { type: String, required: true, select: false },
    role: { type: String, default: 'admin' }
  },
  { timestamps: true }
);

export type Admin = InferSchemaType<typeof AdminSchema>;

export default models.Admin || model('Admin', AdminSchema);
