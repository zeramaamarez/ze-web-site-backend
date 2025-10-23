import { NextResponse } from 'next/server';
import { Types } from 'mongoose';

import { requireAdmin } from '@/lib/api';
import { connectMongo } from '@/lib/mongodb';
import MediaModel, { type MediaDocument } from '@/lib/models/Media';

const ALLOWED_SORT_FIELDS = new Set(['name', 'createdAt', 'size']);

export async function GET(request: Request) {
  const authResult = await requireAdmin();
  if ('response' in authResult) return authResult.response;

  const { searchParams } = new URL(request.url);
  const page = Math.max(parseInt(searchParams.get('page') || '1', 10), 1);
  const pageSizeRaw = parseInt(searchParams.get('pageSize') || '25', 10);
  const pageSize = Math.min(Math.max(pageSizeRaw, 1), 100);
  const search = searchParams.get('search')?.trim();
  const type = searchParams.get('type')?.trim()?.toLowerCase();
  const dateRange = searchParams.get('dateRange')?.trim();
  const dateFromParam = searchParams.get('dateFrom');
  const dateToParam = searchParams.get('dateTo');
  const sizeFilter = searchParams.get('size');
  const sortParam = searchParams.get('sort') || 'createdAt';
  const orderParam = searchParams.get('order') === 'asc' ? 1 : -1;

  const filters: Record<string, unknown>[] = [];

  if (search) {
    filters.push({ name: { $regex: search, $options: 'i' } });
  }

  if (type && type !== 'all') {
    if (type === 'other') {
      filters.push({
        $and: [
          { type: { $nin: ['image', 'video', 'audio', 'raw'] } },
          { mime: { $not: new RegExp('^(image|video|audio)/', 'i') } }
        ]
      });
    } else if (type === 'raw') {
      filters.push({
        $or: [
          { type: 'raw' },
          { mime: { $regex: /^application\//i } },
          { mime: { $regex: /^text\//i } }
        ]
      });
    } else {
      const typeRegex = new RegExp(`^${type}/`, 'i');
      filters.push({
        $or: [{ type }, { mime: { $regex: typeRegex } }]
      });
    }
  }

  const createdAtFilter: { $gte?: Date; $lte?: Date } = {};

  if (dateFromParam) {
    const dateFrom = new Date(dateFromParam);
    if (!Number.isNaN(dateFrom.getTime())) {
      createdAtFilter.$gte = dateFrom;
    }
  }

  if (dateToParam) {
    const dateTo = new Date(dateToParam);
    if (!Number.isNaN(dateTo.getTime())) {
      createdAtFilter.$lte = dateTo;
    }
  }

  if (createdAtFilter.$gte || createdAtFilter.$lte) {
    filters.push({ createdAt: createdAtFilter });
  } else if (dateRange && dateRange !== 'all') {
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

  if (sizeFilter && sizeFilter !== 'all') {
    const sizeQuery: { $lt?: number; $gte?: number } = {};

    switch (sizeFilter) {
      case 'small':
        sizeQuery.$lt = 1024; // < 1MB (size stored in KB)
        break;
      case 'medium':
        sizeQuery.$gte = 1024; // >= 1MB
        sizeQuery.$lt = 5 * 1024; // < 5MB
        break;
      case 'large':
        sizeQuery.$gte = 5 * 1024; // >= 5MB
        break;
      default:
        break;
    }

    if (Object.keys(sizeQuery).length > 0) {
      filters.push({ size: sizeQuery });
    }
  }

  const sortField = ALLOWED_SORT_FIELDS.has(sortParam) ? sortParam : 'createdAt';
  const sort = { [sortField]: orderParam } as Record<string, 1 | -1>;

  const query = filters.length ? { $and: filters } : {};

  await connectMongo();

  const [total, mediaItems] = await Promise.all([
    MediaModel.countDocuments(query),
    MediaModel.find(query)
      .sort(sort)
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean<MediaDocument & { _id: Types.ObjectId; __v?: number }>()
  ]);

  const data = mediaItems.map(({ _id, createdAt, updatedAt, __v, ...rest }) => ({
    ...rest,
    _id: _id.toString(),
    createdAt: createdAt ? createdAt.toISOString() : null,
    updatedAt: updatedAt ? updatedAt.toISOString() : null
  }));

  return NextResponse.json({
    data,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize) || 1
    }
  });
}
