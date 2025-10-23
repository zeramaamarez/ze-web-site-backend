import { models, model, Schema, type InferSchemaType } from 'mongoose';

const MediaSchema = new Schema(
  {
    name: { type: String, required: true },
    url: { type: String, required: true },
    hash: { type: String, index: true },
    cloudinaryId: { type: String, index: true },
    ext: String,
    mime: String,
    type: String,
    size: Number,
    width: Number,
    height: Number,
    provider: String,
    provider_metadata: {
      public_id: String,
      resource_type: String
    }
  },
  {
    collection: 'media',
    timestamps: true
  }
);

MediaSchema.index({ name: 'text' });

export type MediaDocument = InferSchemaType<typeof MediaSchema>;

export default models.Media || model<MediaDocument>('Media', MediaSchema);
