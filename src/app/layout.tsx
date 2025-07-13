// src/app/layout.tsx (แก้ไข Hydration issue)
import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/lib/auth-context';

export const metadata: Metadata = {
  title: 'Joolz Factory',
  description: 'ระบบจัดการโรงงานน้ำผลไม้และสมุนไพร',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th">
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}