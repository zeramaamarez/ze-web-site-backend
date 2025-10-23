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
    if (file.provider_metadata?.public_id) {
      try {
        const cloudinary = (await import('@/lib/cloudinary')).default;
        await cloudinary.uploader.destroy(file.provider_metadata.public_id, {
          resource_type: file.provider_metadata.resource_type || 'image'
        });
      } catch (error) {
        console.error('Erro ao remover arquivo do Cloudinary', error);
      }
    }

    await file.deleteOne();
  }
}
