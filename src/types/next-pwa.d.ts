declare module 'next-pwa' {
  import type { NextConfig } from 'next';
  interface PWAOptions {
    dest: string;
    register?: boolean;
    skipWaiting?: boolean;
    sw?: string;
    cacheStartUrl?: boolean;
    dynamicStartUrl?: boolean;
    runtimeCaching?: unknown[];
    disable?: boolean;
  }
  export default function withPWA(options: PWAOptions): (config: NextConfig) => NextConfig;
}
