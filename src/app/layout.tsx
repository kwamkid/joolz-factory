// app/layout.tsx
import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Sans_Thai } from 'next/font/google';
import { AuthProvider } from '@/lib/auth-context';
import './globals.css';

// Font configuration
const ibmPlexSansThai = IBM_Plex_Sans_Thai({
  weight: ['300', '400', '500', '600', '700'],
  subsets: ['thai', 'latin'],
  display: 'swap',
  variable: '--font-ibm-plex-thai',
});

export const metadata: Metadata = {
  title: 'Joolz Factory - ระบบจัดการโรงงานน้ำผลไม้',
  description: 'ระบบจัดการโรงงานผลิตน้ำผลไม้และสมุนไพร',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#00231F',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th" className={ibmPlexSansThai.variable}>
      <body className={`${ibmPlexSansThai.className} antialiased`}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}