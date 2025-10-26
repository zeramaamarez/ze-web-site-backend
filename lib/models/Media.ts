import { models, model, Schema, type InferSchemaType } from 'mongoose';

const FormatSchema = new Schema(
  {
    url: String,
    width: Number,
    height: Number,
    size: Number,
    provider_metadata: {
      public_id: String,
      resource_type: String
    }
  },
  { _id: false }
);

const RelatedSchema = new Schema(
  {
    ref: { type: Schema.Types.ObjectId, required: true },
    kind: { type: String, required: true },
    field: { type: String, required: true }
  },
  { _id: false }
);

const MediaSchema = new Schema(
  {
    name: { type: String, required: true },
    alternativeText: String,
    caption: String,
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
    },
    formats: {
      thumbnail: FormatSchema,
      small: FormatSchema,
      medium: FormatSchema,
      large: FormatSchema
    },
    related: [RelatedSchema]
  },
  {
    collection: 'media',
    timestamps: true
  }
);

MediaSchema.index({ name: 'text' });

export type MediaDocument = InferSchemaType<typeof MediaSchema>;

export default models.Media || model<MediaDocument>('Media', MediaSchema);
