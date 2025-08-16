// app/page.tsx
import { redirect } from 'next/navigation';

export default function HomePage() {
  // Redirect ไปหน้า login เป็น default
  // ในอนาคตจะเช็ค auth status ก่อน redirect
  redirect('/login');
  
  // ไม่ต้อง return อะไร เพราะ redirect จะทำงานก่อน
  return null;
}