import type { MetadataRoute } from 'next';
import { getPublicEnv } from '@/lib/env';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getPublicEnv().siteUrl.replace(/\/$/, '');
  const now = new Date();

  return [
    { url: `${base}/`, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/explorar`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${base}/registro`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/login`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${base}/privacidad`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/terminos`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
  ];
}
