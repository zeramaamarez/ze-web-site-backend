import { models, model, Schema, Types, type InferSchemaType } from 'mongoose';

const CdTrackSchema = new Schema(
  {
    name: { type: String, required: true },
    composers: String,
    time: String,
    track: { type: Types.ObjectId, ref: 'UploadFile' },
    lyric: String
  },
  {
    timestamps: true,
    collection: 'components_cd_tracks'
  }
);

CdTrackSchema.index({ name: 'text', composers: 'text' });

export type CdTrack = InferSchemaType<typeof CdTrackSchema>;

export default models.CdTrack || model('CdTrack', CdTrackSchema);
