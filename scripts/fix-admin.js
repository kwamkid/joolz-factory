// scripts/fix-admin.js
const { initializeApp, cert } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");
require("dotenv").config({ path: ".env.local" });

// Initialize Firebase Admin
const app = initializeApp({
  credential: cert({
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, "\n"),
  }),
});

const auth = getAuth();
const db = getFirestore();

async function fixAdminUser() {
  const adminEmail = "admin@joolzfactory.com";
  const adminUid = "X6bMpc5JzBOz2nL1OjuUBypYLi32"; // UID จาก list users
  const newPassword = "MKthailand47";

  try {
    console.log("🔧 กำลังแก้ไข Admin User...\n");

    // 1. อัพเดท Auth User
    await auth.updateUser(adminUid, {
      displayName: "System Admin",
      emailVerified: true,
      password: newPassword,
    });
    console.log("✅ อัพเดท Auth User สำเร็จ");

    // 2. สร้าง/อัพเดท Firestore Document
    await db.collection("users").doc(adminUid).set(
      {
        email: adminEmail,
        name: "System Admin",
        role: "admin",
        isSystemAdmin: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      { merge: true }
    );
    console.log("✅ อัพเดท Firestore Document สำเร็จ");

    // 3. แก้ไข kwamkid user ด้วย (ถ้าต้องการ)
    const kwamkidUid = "j83doLGkBgOLujmwqYUcYBYPWWC2";
    try {
      const kwamkidUser = await auth.getUser(kwamkidUid);

      await db
        .collection("users")
        .doc(kwamkidUid)
        .set(
          {
            email: kwamkidUser.email,
            name: kwamkidUser.displayName || "Kwamkid User",
            role: "manager", // หรือ 'operation' ตามต้องการ
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          { merge: true }
        );

      console.log("✅ สร้าง Firestore Document สำหรับ kwamkid@gmail.com");
    } catch (error) {
      console.log("⚠️  ไม่สามารถอัพเดท kwamkid user");
    }

    console.log("\n✅ แก้ไขข้อมูลเสร็จสิ้น!");
    console.log("\n🔐 Admin Login Credentials:");
    console.log("Email:", adminEmail);
    console.log("Password:", newPassword);
    console.log("\n💡 ทดสอบ login ด้วย: npm run test:firebase");
  } catch (error) {
    console.error("❌ Error:", error.message);
  }

  process.exit();
}

fixAdminUser();
