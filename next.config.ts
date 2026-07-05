import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ['antd', '@ant-design/icons', 'rc-util', 'rc-picker', 'rc-tree', 'rc-table', 'rc-input'],
  experimental: {
    optimizePackageImports: ['antd', '@ant-design/icons'],
  },
  // Allow Next.js <Image> to load from Vercel Blob Storage
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.public.blob.vercel-storage.com',
      },
    ],
  },
  // Prevent decimal.js from being mangled by the bundler
  serverExternalPackages: ['decimal.js'],
};

export default nextConfig;
