/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: process.env.S3_IMAGE_PUBLIC_BASE_URL
          ? new URL(process.env.S3_IMAGE_PUBLIC_BASE_URL).hostname
          : 'd10whcg56p8om0.cloudfront.net',
        pathname: '/**',
      },
    ],
    domains: [
      'img.clerk.com',
      'images.clerk.dev',
      'www.gravatar.com',
      'replicate.delivery',
    ],
  },
  experimental: {
    esmExternals: 'loose',
  },
};

export default nextConfig;
