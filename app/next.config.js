/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Webpack config for Solana wallet adapter compatibility
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      crypto: false,
      stream: false,
      buffer: false,
    };
    return config;
  },
  // Suppress hydration warnings from wallet adapter
  experimental: {
    missingSuspenseWithCSRBailout: false,
  },
};

module.exports = nextConfig;
