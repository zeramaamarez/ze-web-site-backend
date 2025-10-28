import { models, model, Schema, Types, type InferSchemaType } from 'mongoose';

const DvdTrackSchema = new Schema(
  {
    name: { type: String, required: true },
    composers: String,
    label: String,
    time: String,
    lyric: String,
    track: { type: Types.ObjectId, ref: 'UploadFile' }
  },
  {
    timestamps: true,
    collection: 'components_dvd_tracks'
  }
);

DvdTrackSchema.index({ name: 'text', composers: 'text', label: 'text' });

export type DvdTrack = InferSchemaType<typeof DvdTrackSchema>;

export default models.DvdTrack || model('DvdTrack', DvdTrackSchema);
