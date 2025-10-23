import { v2 as cloudinary } from 'cloudinary';
import { env } from '@/lib/env';

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
  secure: true
});

type CloudinaryUsageMetric = {
  usage: number;
  limit?: number | null;
  usedPercent?: number | null;
};

type CloudinaryUsageApiResponse = {
  storage?: {
    usage?: number;
    limit?: number;
    used_percent?: number;
  };
  bandwidth?: {
    usage?: number;
    limit?: number;
    used_percent?: number;
  };
  resources?:
    | number
    | {
        usage?: number;
        limit?: number;
        used_percent?: number;
      };
  last_updated?: string;
  [key: string]: unknown;
};

export interface CloudinaryUsage {
  storage: CloudinaryUsageMetric;
  bandwidth: CloudinaryUsageMetric;
  resources: CloudinaryUsageMetric;
  lastUpdated?: string;
  raw: CloudinaryUsageApiResponse;
}

export async function getCloudinaryUsage(): Promise<CloudinaryUsage> {
  const usage = (await cloudinary.api.usage()) as CloudinaryUsageApiResponse;

  const storage: CloudinaryUsageMetric = {
    usage: usage?.storage?.usage ?? 0,
    limit: usage?.storage?.limit ?? null,
    usedPercent: usage?.storage?.used_percent ?? null
  };

  const bandwidth: CloudinaryUsageMetric = {
    usage: usage?.bandwidth?.usage ?? 0,
    limit: usage?.bandwidth?.limit ?? null,
    usedPercent: usage?.bandwidth?.used_percent ?? null
  };

  const resourceUsageRaw = usage?.resources;
  const resources: CloudinaryUsageMetric = {
    usage:
      typeof resourceUsageRaw === 'number'
        ? resourceUsageRaw
        : resourceUsageRaw?.usage ?? 0,
    limit:
      typeof resourceUsageRaw === 'number'
        ? null
        : resourceUsageRaw?.limit ?? null,
    usedPercent:
      typeof resourceUsageRaw === 'number'
        ? null
        : resourceUsageRaw?.used_percent ?? null
  };

  return {
    storage,
    bandwidth,
    resources,
    lastUpdated: usage?.last_updated,
    raw: usage
  };
}

export default cloudinary;
