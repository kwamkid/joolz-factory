// Path: app/(protected)/page.tsx
import { redirect } from 'next/navigation';

export default function ProtectedIndexPage() {
  // Redirect to dashboard when accessing /protected
  redirect('/dashboard');
}