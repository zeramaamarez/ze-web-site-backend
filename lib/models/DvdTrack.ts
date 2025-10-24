import { models, model, Schema, Types, type InferSchemaType } from 'mongoose';

const DvdTrackSchema = new Schema(
  {
    name: { type: String, required: true },
    composers: String,
    time: String,
    publishing_company: String,
    lyric: String,
    track: { type: Types.ObjectId, ref: 'UploadFile' }
  },
  { collection: 'dvd_tracks', timestamps: false }
);

DvdTrackSchema.index({ name: 'text', composers: 'text', publishing_company: 'text' });

export type DvdTrack = InferSchemaType<typeof DvdTrackSchema>;

export default models.DvdTrack || model('DvdTrack', DvdTrackSchema);
