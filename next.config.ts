import type { NextConfig } from "next";
import withPWAInit from "next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  register: true,
  skipWaiting: true,
  sw: 'sw.js',
  // Authenticated pages and Server Action responses must never enter a shared
  // browser cache that survives logout or switching company.
  cacheStartUrl: false,
  dynamicStartUrl: false,
  runtimeCaching: [],
  // disable: process.env.NODE_ENV === "development", // desativa no dev
});

const nextConfig: NextConfig = {
  output: 'standalone',
  async rewrites() {
    return [
      // /:slug/dashboard e /:slug/dashboard/* mapeiam internamente para /dashboard/*
      { source: '/:slug/dashboard', destination: '/dashboard' },
      { source: '/:slug/dashboard/:path*', destination: '/dashboard/:path*' },
    ];
  },
  turbopack: {},
  experimental: {
    optimizeCss: true,
    optimizePackageImports: ['lucide-react', '@iconify/react'],
    // Upload de restauração de backup muda Server Actions até 50 MB (igual ao
    // multer `fileSize: 50MB` do POST /backup/restore).
    serverActions: { bodySizeLimit: '50mb' },
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
        port: "8000",
        pathname: "/**",
      },
      {
        protocol: "http",
        hostname: "localhost",
        port: "9000",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "**", // Permite qualquer HTTPS
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '5000',
        pathname: '/uploads/**',
      },
      // Adição do IP que causou o erro:
      {
        protocol: 'http',
        hostname: '187.77.236.241',
        port: '5001',
        pathname: '/uploads/**',
      },
      {
        protocol: 'https',
        hostname: 'nairim.com.br',
        pathname: '/**',
      },
    ],
  },
  generateBuildId: async () => {
    return 'build'
  },
};

export default withPWA(nextConfig as any);
