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
        protocol: "https",
        hostname: "**",
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '5000',
        pathname: '/uploads/**',
      },
      // Adicione também o domínio de produção quando subir o site
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