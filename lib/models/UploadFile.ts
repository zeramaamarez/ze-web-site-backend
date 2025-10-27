import { models, model, Schema, Types, type InferSchemaType } from 'mongoose';

const FormatSchema = new Schema(
  {
    ext: String,
    url: String,
    hash: String,
    mime: String,
    name: String,
    path: String,
    size: Number,
    sizeInBytes: Number,
    width: Number,
    height: Number,
    provider_metadata: {
      public_id: String,
      resource_type: String
    }
  },
  { _id: false }
);

const RelatedSchema = new Schema(
  {
    ref: { type: Types.ObjectId },
    refId: { type: Types.ObjectId },
    kind: String,
    field: String,
    order: Number
  },
  { _id: false, strict: false }
);

const UploadFileSchema = new Schema(
  {
    name: { type: String, required: true },
    alternativeText: String,
    caption: String,
    hash: { type: String, index: true },
    ext: String,
    mime: String,
    size: Number,
    width: Number,
    height: Number,
    url: { type: String, required: true },
    previewUrl: String,
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
    related: [RelatedSchema],
    folderPath: String,
    folder: Schema.Types.Mixed,
    created_by: { type: Types.ObjectId, ref: 'Admin' },
    updated_by: { type: Types.ObjectId, ref: 'Admin' },
    deleted: {
      type: Boolean,
      default: false,
      index: true
    },
    deletedAt: {
      type: Date,
      default: null
    },
    deletedBy: {
      type: Types.ObjectId,
      ref: 'User',
      default: null
    },
    deletionReason: {
      type: String,
      enum: ['cover_replaced', 'track_deleted', 'cd_deleted', 'manual'],
      default: null
    },
    relatedTo: {
      type: String,
      default: null
    }
  },
  {
    collection: 'upload_file',
    timestamps: true,
    strict: false
  }
);

UploadFileSchema.index({ hash: 1 });
UploadFileSchema.index({ deleted: 1, deletedAt: 1 });

export type UploadFile = InferSchemaType<typeof UploadFileSchema>;

export default models.UploadFile || model('UploadFile', UploadFileSchema);
