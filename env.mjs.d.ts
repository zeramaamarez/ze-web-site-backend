export interface AppEnv {
  MONGODB_URI: string;
  MONGODB_DB_NAME: string;
  CLOUDINARY_CLOUD_NAME: string;
  CLOUDINARY_API_KEY: string;
  CLOUDINARY_API_SECRET: string;
  NEXTAUTH_SECRET?: string;
  NEXTAUTH_URL?: string;
  SMTP_HOST?: string;
  SMTP_PORT?: string;
  SMTP_USER?: string;
  SMTP_PASS?: string;
}

export const env: AppEnv;
