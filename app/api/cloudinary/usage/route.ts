import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api';
import { getCloudinaryUsage } from '@/lib/cloudinary';

export async function GET() {
  const authResult = await requireAdmin();
  if ('response' in authResult) {
    return authResult.response;
  }

  try {
    const usage = await getCloudinaryUsage();
    return NextResponse.json({ data: usage });
  } catch (error) {
    console.error('Failed to load Cloudinary usage', error);
    return NextResponse.json(
      { error: 'Não foi possível carregar o uso do Cloudinary' },
      { status: 500 }
    );
  }
}
