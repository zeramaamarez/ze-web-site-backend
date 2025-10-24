import { models, model, Schema, Types, type InferSchemaType } from 'mongoose';

const DvdTrackSchema = new Schema(
  {
    name: { type: String, required: true },
    time: String,
    lyric: { type: Types.ObjectId, ref: 'Lyric' },
    data_sheet: String
  },
  {
    timestamps: true,
    collection: 'components_dvd_tracks'
  }
);

DvdTrackSchema.index({ name: 'text' });

export type DvdTrack = InferSchemaType<typeof DvdTrackSchema>;

export default models.DvdTrack || model('DvdTrack', DvdTrackSchema);
