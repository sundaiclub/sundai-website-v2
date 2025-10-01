/** @type {import('next-sitemap').IConfig} */
const config = {
  siteUrl: process.env.SITE_URL || 'https://sundai.club',
  generateRobotsTxt: true,
  outDir: 'public',
  sitemapSize: 5000,
  exclude: [
    '/admin',
    '/admin/*',
    '/me',
    '/me/*',
    '/api/*',
  ],
  robotsTxtOptions: {
    policies: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/me', '/api'],
      },
    ],
    // next-sitemap will auto-add Host and Sitemap based on siteUrl
  },
};

module.exports = config;


