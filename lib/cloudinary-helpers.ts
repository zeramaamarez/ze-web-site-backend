import { Types } from 'mongoose';

import MediaModel from '@/lib/models/Media';
import UploadFileModel from '@/lib/models/UploadFile';

export type SoftDeleteReason = 'cover_replaced' | 'track_deleted' | 'cd_deleted' | 'dvd_deleted' | 'manual';

interface SoftDeleteOptions {
  mediaId: string | Types.ObjectId;
  reason: SoftDeleteReason;
  userId?: string | Types.ObjectId;
  relatedTo?: string;
}

async function updateSoftDelete(
  model: typeof MediaModel | typeof UploadFileModel,
  mediaId: string | Types.ObjectId,
  reason: SoftDeleteReason,
  userId?: string | Types.ObjectId,
  relatedTo?: string
) {
  const deletedBy =
    typeof userId === 'string'
      ? Types.ObjectId.isValid(userId)
        ? new Types.ObjectId(userId)
        : null
      : userId ?? null;

  return model.findByIdAndUpdate(
    mediaId,
    {
      deleted: true,
      deletedAt: new Date(),
      deletedBy,
      deletionReason: reason,
      relatedTo: relatedTo ?? null
    },
    { new: true }
  );
}

/**
 * Marca um arquivo de mídia como deletado (soft delete)
 * NÃO deleta do Cloudinary - apenas marca no banco
 */
export async function softDeleteMedia(options: SoftDeleteOptions): Promise<boolean> {
  try {
    const { mediaId, reason, userId, relatedTo } = options;

    let result = await updateSoftDelete(MediaModel, mediaId, reason, userId, relatedTo);

    if (!result) {
      result = await updateSoftDelete(UploadFileModel, mediaId, reason, userId, relatedTo);
    }

    if (result) {
      const identifier =
        (result as { cloudinaryId?: string }).cloudinaryId ??
        (result as { filename?: string }).filename ??
        (result as { name?: string }).name ??
        (result as { _id?: Types.ObjectId })._id?.toString() ??
        (typeof mediaId === 'string' ? mediaId : mediaId.toString());

      console.log(`✅ Soft delete: ${identifier} (razão: ${reason})`);
      return true;
    }

    console.warn(`⚠️ Media não encontrada para soft delete: ${mediaId}`);
    return false;
  } catch (error) {
    console.error('❌ Erro no soft delete:', error);
    return false;
  }
}

/**
 * Marca múltiplos arquivos como deletados
 */
export async function softDeleteMultipleMedia(
  mediaIds: (string | Types.ObjectId)[],
  reason: SoftDeleteReason,
  userId?: string | Types.ObjectId,
  relatedTo?: string
): Promise<number> {
  let count = 0;

  for (const mediaId of mediaIds) {
    const success = await softDeleteMedia({ mediaId, reason, userId, relatedTo });
    if (success) count++;
  }

  console.log(`✅ Soft delete completo: ${count}/${mediaIds.length} arquivos marcados`);
  return count;
}
