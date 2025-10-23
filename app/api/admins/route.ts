import { NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/api';
import { connectMongo } from '@/lib/mongodb';
import AdminModel from '@/lib/models/Admin';

export async function GET(request: Request) {
  const authResult = await requireSuperAdmin();
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  await connectMongo();

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');

  const filter: Record<string, unknown> = {};
  if (status === 'pending') {
    filter.approved = false;
  } else if (status === 'approved') {
    filter.approved = true;
  }

  const admins = await AdminModel.find(filter)
    .sort({ createdAt: -1 })
    .populate('approvedBy', 'name email role')
    .lean();

  return NextResponse.json({ data: admins });
}
