import { models, model, Schema, Types, type InferSchemaType } from 'mongoose';

const CdTrackSchema = new Schema(
  {
    name: { type: String, required: true },
    publishing_company: String,
    composers: String,
    time: String,
    lyric: String,
    track: { type: Types.ObjectId, ref: 'UploadFile' },
    data_sheet: String
  },
  { collection: 'cd_tracks', timestamps: false }
);

CdTrackSchema.index({ name: 'text', composers: 'text', publishing_company: 'text' });

export type CdTrack = InferSchemaType<typeof CdTrackSchema>;

export default models.CdTrack || model('CdTrack', CdTrackSchema);
