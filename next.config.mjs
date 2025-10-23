import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const nextConfig = {
  experimental: {
    serverActions: true
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com'
      },
      {
        protocol: 'https',
        hostname: 'img.youtube.com'
      }
    ]
  }
};

export default nextConfig;
