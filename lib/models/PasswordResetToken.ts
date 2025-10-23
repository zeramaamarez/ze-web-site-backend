import { models, model, Schema, Types, type InferSchemaType } from 'mongoose';

const PasswordResetTokenSchema = new Schema(
  {
    adminId: { type: Types.ObjectId, ref: 'Admin', required: true },
    token: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true }
  },
  { timestamps: true }
);

PasswordResetTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type PasswordResetToken = InferSchemaType<typeof PasswordResetTokenSchema>;

export default models.PasswordResetToken || model('PasswordResetToken', PasswordResetTokenSchema);
