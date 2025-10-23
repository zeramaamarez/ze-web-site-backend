import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';

const AdminSchema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, index: true },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: ['admin', 'super_admin'], default: 'admin' },
    approved: { type: Boolean, default: false },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'Admin' },
    approvedAt: { type: Date }
  },
  { timestamps: true }
);

export type Admin = InferSchemaType<typeof AdminSchema>;

type AdminModel = Model<Admin>;

export default (models?.Admin as AdminModel | undefined) ||
  model<Admin>('Admin', AdminSchema);
