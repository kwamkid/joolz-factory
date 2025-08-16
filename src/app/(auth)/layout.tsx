// app/(auth)/layout.tsx
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Auth pages ไม่ต้องมี sidebar/header
  return <>{children}</>;
}