import UploadFileModel from '@/lib/models/UploadFile';
import type { Types } from 'mongoose';

interface UpdateRelatedParams {
  fileId?: string | Types.ObjectId | null;
  refId: string | Types.ObjectId;
  kind: string;
  field: string;
}

export async function attachFile({ fileId, refId, kind, field }: UpdateRelatedParams) {
  if (!fileId) return;

  await UploadFileModel.findByIdAndUpdate(fileId, {
    $addToSet: {
      related: {
        ref: refId,
        kind,
        field
      }
    }
  });
}

export async function detachFile(fileId?: string | Types.ObjectId | null, refId?: string | Types.ObjectId) {
  if (!fileId) return;

  await UploadFileModel.findByIdAndUpdate(fileId, {
    $pull: {
      related: { ref: refId }
    }
  });
}

export async function deleteFileIfOrphan(fileId?: string | Types.ObjectId | null) {
  if (!fileId) return;

  const file = await UploadFileModel.findById(fileId);
  if (!file) return;

  if (!file.related?.length) {
    console.info('[UPLOAD] Orphan file preserved', {
      id: file._id.toString(),
      name: file.name,
      provider: file.provider,
      publicId: file.provider_metadata?.public_id
    });
  }
}
