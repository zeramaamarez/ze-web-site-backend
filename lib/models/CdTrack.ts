import { models, model, Schema, type InferSchemaType } from 'mongoose';

const CdTrackSchema = new Schema(
  {
    name: { type: String, required: true },
    composers: String
  },
  { timestamps: true }
);

CdTrackSchema.index({ name: 'text', composers: 'text' });

export type CdTrack = InferSchemaType<typeof CdTrackSchema>;

export default models.CdTrack || model('CdTrack', CdTrackSchema);
