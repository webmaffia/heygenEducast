import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    '@remotion/bundler',
    '@remotion/renderer',
    '@remotion/media-utils',
    'remotion',
    'esbuild',
  ],
};

export default nextConfig;
