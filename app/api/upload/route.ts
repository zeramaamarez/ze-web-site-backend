import { NextResponse } from 'next/server';
import { Readable } from 'stream';
import crypto from 'crypto';
import cloudinary from '@/lib/cloudinary';
import type { UploadApiResponse } from 'cloudinary';
import { connectMongo } from '@/lib/mongodb';
import UploadFileModel from '@/lib/models/UploadFile';
import { requireAdmin } from '@/lib/api';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/ogg'
]);

async function uploadToCloudinary(
  buffer: Buffer,
  folder?: string,
  resourceType: 'image' | 'video' | 'raw' = 'image'
) {
  return new Promise<UploadApiResponse>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: resourceType,
        eager:
          resourceType === 'image'
            ? [
                { width: 150, height: 150, crop: 'fill' },
                { width: 400, crop: 'limit' },
                { width: 800, crop: 'limit' }
              ]
            : undefined
      },
      (error, result) => {
        if (error || !result) {
          reject(error);
        } else {
          resolve(result);
        }
      }
    );

    Readable.from(buffer).pipe(stream);
  });
}

export async function POST(request: Request) {
  const authResult = await requireAdmin();
  if ('response' in authResult) return authResult.response;

  const formData = await request.formData();
  const file = formData.get('file');
  const folder = formData.get('folder')?.toString() || undefined;

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Arquivo não informado' }, { status: 400 });
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: 'Tipo de arquivo não suportado' }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'Arquivo muito grande' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const hash = crypto.createHash('md5').update(buffer).digest('hex');

  await connectMongo();
  const existing = await UploadFileModel.findOne({ hash }).lean();
  if (existing) {
    return NextResponse.json(existing);
  }

  let resourceType: 'image' | 'video' | 'raw' = 'image';
  if (file.type.startsWith('audio/')) {
    resourceType = 'raw';
  } else if (file.type.startsWith('video/')) {
    resourceType = 'video';
  }

  try {
    const result = await uploadToCloudinary(buffer, folder, resourceType);

    const formats =
      resourceType === 'image'
        ? (result.eager?.reduce<Record<string, unknown>>((acc, item, index) => {
            const key = index === 0 ? 'thumbnail' : index === 1 ? 'small' : 'medium';
            acc[key] = {
              url: item.secure_url,
              width: item.width,
              height: item.height,
              size: item.bytes ? item.bytes / 1024 : undefined,
              provider_metadata: {
                public_id: item.public_id,
                resource_type: item.resource_type
              }
            };
            return acc;
          }, {}) ?? {})
        : {};

    const upload = await UploadFileModel.create({
      name: file.name,
      alternativeText: '',
      caption: '',
      hash,
      ext: `.${result.format}`,
      mime: file.type,
      size: result.bytes ? result.bytes / 1024 : file.size / 1024,
      width: result.width,
      height: result.height,
      url: result.secure_url,
      provider: 'cloudinary',
      provider_metadata: {
        public_id: result.public_id,
        resource_type: result.resource_type
      },
      formats,
      related: []
    });

    return NextResponse.json(upload, { status: 201 });
  } catch (error) {
    console.error('Upload error', error);
    return NextResponse.json({ error: 'Falha no upload' }, { status: 500 });
  }
}
