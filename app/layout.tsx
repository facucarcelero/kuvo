import type { Metadata, Viewport } from 'next';
import './globals.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  title: { default: 'KUVO — Negocios + Creadores', template: '%s | KUVO' },
  description: 'Marketplace profesional que conecta negocios con creadores para gestionar campañas, propuestas y resultados.',
  applicationName: 'KUVO',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [{ url: '/icons/icon.svg', type: 'image/svg+xml' }, { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
    shortcut: '/favicon.ico',
  },
  openGraph: {
    title: 'KUVO — Negocios + Creadores',
    description: 'Encontrá creadores, publicá campañas y gestioná colaboraciones desde un solo lugar.',
    type: 'website',
    locale: 'es_AR',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'KUVO' }],
  },
  twitter: { card: 'summary_large_image', title: 'KUVO', description: 'Negocios + Creadores', images: ['/og-image.png'] },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#09090f' },
    { media: '(prefers-color-scheme: light)', color: '#f7f7fb' },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const runtimeConfig = {
    supabaseUrl: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
  };
  const serialized = JSON.stringify(runtimeConfig).replace(/</g, '\u003c');
  const bootScript = `window.__KUVO_CONFIG__=${serialized};if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}))}`;
  return <html lang="es" data-theme="dark"><body>{children}<script dangerouslySetInnerHTML={{__html:bootScript}}/></body></html>;
}
