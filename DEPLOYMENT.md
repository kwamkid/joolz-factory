# Vercel Deployment Guide - Joolz Factory

## Environment Variables

คัดลอก environment variables ต่อไปนี้ไปใส่ใน Vercel Dashboard:

### Required Environment Variables

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://kaidsjjzzbquojcdsjbt.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImthaWRzamp6emJxdW9qY2RzamJ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI0ODIwMjYsImV4cCI6MjA3ODA1ODAyNn0.nBPHzILuHN0U3blvWq1w9oQ3hYUw1PieeIXQXqlhcoQ
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImthaWRzamp6emJxdW9qY2RzamJ0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjQ4MjAyNiwiZXhwIjoyMDc4MDU4MDI2fQ.P4Xfg1xCGwKs8O6pGPcf19XD1JO-0fpSPf6Xe-jwuPs
```

## Step-by-Step Deployment

### 1. เตรียม Vercel Account
1. ไปที่ [https://vercel.com](https://vercel.com)
2. Sign up หรือ Login ด้วย GitHub account
3. ให้สิทธิ์ Vercel เข้าถึง GitHub repositories

### 2. Import Project
1. ใน Vercel Dashboard คลิก **"Add New..."** → **"Project"**
2. เลือก **"Import Git Repository"**
3. ค้นหาและเลือก repository: `kwamkid/joolz-factory`
4. คลิก **"Import"**

### 3. Configure Project Settings

#### Framework Preset
- Vercel จะตรวจจับอัตโนมัติว่าเป็น **Next.js**
- ไม่ต้องเปลี่ยนแปลง Build Command และ Output Directory

#### Build Settings (ค่าเริ่มต้น):
```
Build Command: npm run build
Output Directory: .next
Install Command: npm install
```

### 4. Add Environment Variables
ใน **"Environment Variables"** section:

1. เพิ่ม variable ทั้ง 3 ตัว:

| Name | Value |
|------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://kaidsjjzzbquojcdsjbt.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImthaWRzamp6emJxdW9qY2RzamJ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI0ODIwMjYsImV4cCI6MjA3ODA1ODAyNn0.nBPHzILuHN0U3blvWq1w9oQ3hYUw1PieeIXQXqlhcoQ` |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImthaWRzamp6emJxdW9qY2RzamJ0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjQ4MjAyNiwiZXhwIjoyMDc4MDU4MDI2fQ.P4Xfg1xCGwKs8O6pGPcf19XD1JO-0fpSPf6Xe-jwuPs` |

2. สำหรับแต่ละ variable เลือก environments:
   - ✅ Production
   - ✅ Preview
   - ✅ Development

### 5. Deploy
1. คลิก **"Deploy"**
2. รอ Vercel build และ deploy (ประมาณ 2-3 นาที)
3. เมื่อเสร็จจะได้ URL เช่น `https://joolz-factory.vercel.app`

## Post-Deployment Checklist

### ✅ ตรวจสอบหลัง Deploy สำเร็จ

1. **ทดสอบ Login**
   - เข้า `https://your-app.vercel.app/login`
   - ลอง login ด้วย user ที่มีอยู่

2. **ทดสอบหน้าสำคัญ**
   - หน้า Dashboard
   - หน้า Orders
   - หน้า Production
   - หน้า Products
   - ทดสอบ Shipping Labels (พิมพ์ใบปะหน้า)

3. **ตรวจสอบ API Routes**
   - เปิด Browser DevTools (F12)
   - ดู Network tab ว่า API calls ทำงานปกติ
   - ไม่มี 500 errors

### 🔒 Security Note

**IMPORTANT**: `SUPABASE_SERVICE_ROLE_KEY` มีสิทธิ์เต็มในการเข้าถึง database
- ไม่ควรแชร์ key นี้กับคนอื่น
- ใช้เฉพาะใน server-side code (API routes)
- ถ้า key รั่วไหลให้ไป reset ที่ Supabase Dashboard ทันที

## Supabase CORS Configuration

ถ้าพบปัญหา CORS errors:

1. ไปที่ Supabase Dashboard: [https://supabase.com/dashboard/project/kaidsjjzzbquojcdsjbt](https://supabase.com/dashboard/project/kaidsjjzzbquojcdsjbt)
2. เข้าไปที่ **Settings** → **API**
3. เพิ่ม Vercel URL ของคุณใน **Allowed Origins**:
   ```
   https://joolz-factory.vercel.app
   https://joolz-factory-*.vercel.app
   ```

## Custom Domain (Optional)

ถ้าต้องการใช้ domain ของตัวเอง:

1. ใน Vercel Project ไปที่ **Settings** → **Domains**
2. เพิ่ม custom domain (เช่น `factory.joolzjuice.com`)
3. ตั้งค่า DNS ตามที่ Vercel บอก
4. รอ DNS propagate (5-30 นาที)

## Automatic Deployments

Vercel จะ deploy อัตโนมัติเมื่อ:
- Push ไป `main` branch → Production deployment
- Push ไป branch อื่น → Preview deployment
- Open Pull Request → Preview deployment พร้อม unique URL

## Monitoring & Logs

ดู logs และ monitor ได้ที่:
- Vercel Dashboard → Project → **Deployments**
- คลิกที่ deployment → **Build Logs** และ **Function Logs**
- Real-time errors จะแสดงใน **Runtime Logs**

## Troubleshooting

### Build Failed
- ตรวจสอบ Build Logs
- มักเกิดจาก TypeScript errors หรือ missing dependencies
- ลองรัน `npm run build` ใน local ก่อน

### 500 Server Errors
- ตรวจสอบ Function Logs
- มักเกิดจาก missing environment variables
- หรือ database connection issues

### Slow Response
- Vercel serverless functions มี cold start
- ถ้าไม่มีใช้งานนาน function จะ sleep
- Request แรกจะช้า request ถัดไปจะเร็วขึ้น

---

**Need Help?**
- Vercel Docs: https://vercel.com/docs
- Supabase Docs: https://supabase.com/docs
- Next.js Docs: https://nextjs.org/docs
