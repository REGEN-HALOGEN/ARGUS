import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@argus/ui', '@argus/types'],
  experimental: {
    optimizePackageImports: ['lucide-react', 'framer-motion'],
  },
};

export default nextConfig;
