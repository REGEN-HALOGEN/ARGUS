import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@argus/ui', '@argus/types'],
  experimental: {
    optimizePackageImports: ['lucide-react', 'framer-motion'],
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1',
    NEXT_PUBLIC_BETTER_AUTH_URL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL || 'http://localhost:4000/api/v1/auth',
  },
};

export default nextConfig;
