import type { MetadataRoute } from 'next';
import { getPublicEnv } from '@/lib/env';

export default function robots(): MetadataRoute.Robots {
  const base = getPublicEnv().siteUrl.replace(/\/$/, '');
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/panel', '/auth/', '/api/'],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
