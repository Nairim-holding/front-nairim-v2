import type { NextConfig } from "next";
import withPWAInit from "next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  register: true,
  skipWaiting: true,
  sw: 'sw.js',
  // disable: process.env.NODE_ENV === "development", // desativa no dev
});

const nextConfig: NextConfig = {
  output: 'standalone',
  async rewrites() {
    return [
      // /:slug/dashboard e /:slug/dashboard/* mapeiam internamente para /dashboard/*
      // preservando o slug na URL para identificar visualmente a empresa
      { source: '/:slug/dashboard', destination: '/dashboard' },
      { source: '/:slug/dashboard/:path*', destination: '/dashboard/:path*' },
    ];
  },
  turbopack: {},
  experimental: {
    optimizeCss: true,
    optimizePackageImports: ['lucide-react', '@iconify/react'],
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