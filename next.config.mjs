/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    domains: [
      "img.clerk.com",
      "images.clerk.dev",
      "www.gravatar.com",
      "storage.googleapis.com",
    ],
  },
  experimental: {
    esmExternals: 'loose'
  }
};

export default nextConfig;
