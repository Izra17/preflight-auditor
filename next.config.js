/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  // Playwright + Chromium must never be bundled into the client/edge runtime.
  experimental: {
    serverComponentsExternalPackages: ['playwright']
  }
};

module.exports = nextConfig;
