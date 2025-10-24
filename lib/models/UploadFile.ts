import { models, model, Schema, Types, type InferSchemaType } from 'mongoose';

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
    ref: { type: Types.ObjectId, required: true },
    kind: { type: String, required: true },
    field: { type: String, required: true }
  },
  { _id: false }
);

const UploadFileSchema = new Schema(
  {
    name: String,
    alternativeText: String,
    caption: String,
    hash: { type: String },
    ext: String,
    mime: String,
    size: Number,
    width: Number,
    height: Number,
    url: { type: String, required: true },
    provider: String,
    provider_metadata: {
      public_id: String,
      resource_type: String
    },
    formats: {
      thumbnail: FormatSchema,
      small: FormatSchema,
      medium: FormatSchema
    },
    related: [RelatedSchema]
  },
  { timestamps: true }
);

UploadFileSchema.index({ hash: 1 }, { unique: false });

export type UploadFile = InferSchemaType<typeof UploadFileSchema>;

export default models.UploadFile || model('UploadFile', UploadFileSchema);
