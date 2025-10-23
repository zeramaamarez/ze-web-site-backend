import { z } from 'zod';

const serverSchema = z.object({
  MONGODB_URI: z.string().min(1),
  MONGODB_DB_NAME: z.string().min(1),
  CLOUDINARY_CLOUD_NAME: z.string().min(1),
  CLOUDINARY_API_KEY: z.string().min(1),
  CLOUDINARY_API_SECRET: z.string().min(1),
  NEXTAUTH_SECRET: z.string().optional(),
  NEXTAUTH_URL: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional()
});

const _server = serverSchema.safeParse(process.env);
if (!_server.success) {
  console.error('Invalid server env:', _server.error.flatten().fieldErrors);
  throw new Error('Missing/invalid env vars');
}

export const env = _server.data;

if (process.env.NODE_ENV !== 'production') {
  console.log('[ENV] loaded:', {
    hasMongoUri: Boolean(env.MONGODB_URI),
    dbName: env.MONGODB_DB_NAME,
    hasCloudinary:
      Boolean(env.CLOUDINARY_CLOUD_NAME) &&
      Boolean(env.CLOUDINARY_API_KEY) &&
      Boolean(env.CLOUDINARY_API_SECRET)
  });
}
