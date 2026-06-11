import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@argus/ui', '@argus/types'],
  experimental: {
    optimizePackageImports: ['lucide-react', 'framer-motion'],
  },
  env: {
    // Default to relative path for client-side to use the rewrite proxy, avoiding CORS/Adblock issues
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || '/api/v1',
    NEXT_PUBLIC_BETTER_AUTH_URL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL || '/api/v1/auth',
  },
  async rewrites() {
    // Map /api to the actual backend API URL. If NEXT_PUBLIC_API_URL is an absolute URL, 
    // we should use its base, otherwise we use a fallback or an internal API_URL env variable.
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
