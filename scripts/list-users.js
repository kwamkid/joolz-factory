// scripts/list-users.js
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

async function listAllUsers() {
  try {
    console.log("📋 รายชื่อ Users ทั้งหมด:");
    console.log("=====================================\n");

    // List users from Auth
    const listUsersResult = await auth.listUsers(100);

    if (listUsersResult.users.length === 0) {
      console.log("❌ ไม่พบ users ในระบบ");
      console.log("💡 ลองรัน npm run setup:admin เพื่อสร้าง admin user");
      process.exit();
    }

    for (const user of listUsersResult.users) {
      console.log(`👤 User: ${user.email || "No email"}`);
      console.log(`   UID: ${user.uid}`);
      console.log(`   Name: ${user.displayName || "No name"}`);
      console.log(`   Email Verified: ${user.emailVerified ? "✅" : "❌"}`);
      console.log(
        `   Created: ${new Date(user.metadata.creationTime).toLocaleString(
          "th-TH"
        )}`
      );

      // ดึงข้อมูล role จาก Firestore
      try {
        const userDoc = await db.collection("users").doc(user.uid).get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          console.log(`   Role: ${userData.role || "No role"}`);
        } else {
          console.log(`   Role: ❌ ไม่มีข้อมูลใน Firestore`);
        }
      } catch (error) {
        console.log(`   Role: ❌ Error reading Firestore`);
      }

      console.log("-------------------------------------");
    }

    console.log(`\n📊 Total users: ${listUsersResult.users.length}`);
  } catch (error) {
    console.error("❌ Error:", error.message);
  }

  process.exit();
}

listAllUsers();
