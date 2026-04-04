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
    ],
  },
  generateBuildId: async () => {
    return 'build'
  },
};

export default withPWA(nextConfig as any);