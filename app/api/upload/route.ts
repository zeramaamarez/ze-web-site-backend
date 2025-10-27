import { NextResponse } from 'next/server';
import { Readable } from 'stream';
import crypto from 'crypto';
import cloudinary from '@/lib/cloudinary';
import type { UploadApiResponse } from 'cloudinary';
import { connectMongo } from '@/lib/mongodb';
import UploadFileModel from '@/lib/models/UploadFile';
import { requireAdmin } from '@/lib/api';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_AUDIO_FILE_SIZE = 100 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/ogg',
  'audio/flac',
  'audio/x-flac'
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

export async function GET(request: Request) {
  const authResult = await requireAdmin();
  if ('response' in authResult) return authResult.response;

  const { searchParams } = new URL(request.url);
  const page = Math.max(parseInt(searchParams.get('page') || '1', 10), 1);
  const pageSizeRaw = parseInt(searchParams.get('pageSize') || '25', 10);
  const pageSize = Math.min(Math.max(pageSizeRaw, 1), 100);
  const search = searchParams.get('search');
  const type = searchParams.get('type');
  const dateRange = searchParams.get('dateRange');
  const size = searchParams.get('size');
  const sortParam = searchParams.get('sort') || 'createdAt';
  const orderParam = searchParams.get('order') === 'asc' ? 1 : -1;

  const filters: Record<string, unknown>[] = [];

  if (search) {
    filters.push({ name: { $regex: search, $options: 'i' } });
  }

  if (type && type !== 'all') {
    if (type === 'other') {
      filters.push({ mime: { $not: new RegExp('^(image|audio|video)/', 'i') } });
    } else if (type === 'raw') {
      filters.push({ 'provider_metadata.resource_type': 'raw' });
    } else {
      filters.push({ mime: { $regex: new RegExp(`^${type}/`, 'i') } });
    }
  }

  if (dateRange && dateRange !== 'all') {
    const now = Date.now();
    let milliseconds = 0;
    switch (dateRange) {
      case '24h':
        milliseconds = 24 * 60 * 60 * 1000;
        break;
      case '7d':
        milliseconds = 7 * 24 * 60 * 60 * 1000;
        break;
      case '30d':
        milliseconds = 30 * 24 * 60 * 60 * 1000;
        break;
      case '90d':
        milliseconds = 90 * 24 * 60 * 60 * 1000;
        break;
      case '365d':
        milliseconds = 365 * 24 * 60 * 60 * 1000;
        break;
      default:
        milliseconds = 0;
    }

    if (milliseconds > 0) {
      const startDate = new Date(now - milliseconds);
      filters.push({ createdAt: { $gte: startDate } });
    }
  }

  if (size && size !== 'all') {
    const sizeFilter: { $lt?: number; $gte?: number } = {};
    // The "size" field is stored in kilobytes
    switch (size) {
      case 'small':
        sizeFilter.$lt = 1024; // < 1 MB
        break;
      case 'medium':
        sizeFilter.$gte = 1024; // >= 1 MB
        sizeFilter.$lt = 5 * 1024; // < 5 MB
        break;
      case 'large':
        sizeFilter.$gte = 5 * 1024; // >= 5 MB
        break;
      default:
        break;
    }

    if (Object.keys(sizeFilter).length > 0) {
      filters.push({ size: sizeFilter });
    }
  }

  const allowedSorts = new Set(['name', 'createdAt', 'size']);
  const sortField = allowedSorts.has(sortParam) ? sortParam : 'createdAt';
  const sort = { [sortField]: orderParam } as Record<string, 1 | -1>;

  const query = filters.length ? { $and: filters } : {};

  await connectMongo();

  const [total, uploads] = await Promise.all([
    UploadFileModel.countDocuments(query),
    UploadFileModel.find(query)
      .sort(sort)
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean()
  ]);

  return NextResponse.json({
    data: uploads,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize) || 1
    }
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

  const isAudio = file.type.startsWith('audio/');
  const maxSize = isAudio ? MAX_AUDIO_FILE_SIZE : MAX_FILE_SIZE;

  if (file.size > maxSize) {
    const maxLabel = isAudio ? '100MB' : `${Math.round(MAX_FILE_SIZE / (1024 * 1024))}MB`;
    return NextResponse.json({ error: `Arquivo muito grande. Tamanho máximo: ${maxLabel}` }, { status: 400 });
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
