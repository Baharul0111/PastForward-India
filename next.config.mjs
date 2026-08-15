/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Remotion's renderer is a heavy native/node-only dep. It is only ever imported
  // from scripts/render.ts (a node process), never from the Next bundle — but if a
  // route ever pulls it in transitively, keep it external.
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [...(config.externals || []), "@remotion/renderer", "@remotion/bundler"];
    }
    return config;
  },
  experimental: {
    // API routes write into ./cache and ./public — keep them on the node runtime.
    serverComponentsExternalPackages: ["@remotion/renderer", "@remotion/bundler", "sharp"],
  },
};

export default nextConfig;
