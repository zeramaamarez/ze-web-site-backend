import UploadFileModel from '@/lib/models/UploadFile';
import type { Types } from 'mongoose';
import { softDeleteMedia, type SoftDeleteReason } from '@/lib/cloudinary-helpers';

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

interface DeleteFileIfOrphanOptions {
  reason?: SoftDeleteReason;
  relatedTo?: string;
  userId?: string | Types.ObjectId;
}

export async function deleteFileIfOrphan(
  fileId?: string | Types.ObjectId | null,
  { reason = 'manual', relatedTo, userId }: DeleteFileIfOrphanOptions = {}
) {
  if (!fileId) return;

  const file = await UploadFileModel.findById(fileId);
  if (!file) return;

  if (!file.related?.length) {
    if (file.deleted) {
      console.info('[UPLOAD] Arquivo já marcado para deleção', {
        id: file._id.toString(),
        name: file.name
      });
      return;
    }

    await softDeleteMedia({
      mediaId: file._id,
      reason,
      relatedTo: relatedTo ?? `UploadFile:${file._id.toString()}`,
      userId
    });
  }
}
