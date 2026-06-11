import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@argus/ui', '@argus/types'],
  experimental: {
    optimizePackageImports: ['lucide-react', 'framer-motion'],
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1',
    NEXT_PUBLIC_BETTER_AUTH_URL:
      process.env.NEXT_PUBLIC_BETTER_AUTH_URL || 'http://localhost:4000/api/v1/auth',
  },
  async rewrites() {
    // Map /api to the actual backend API URL.
    const backendUrl = process.env.API_URL || 'http://localhost:4000/api';
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/:path*`, // Proxy to Backend
      },
    ];
  },
};

export default nextConfig;
