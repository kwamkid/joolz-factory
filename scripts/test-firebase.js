// scripts/test-firebase.js
require("dotenv").config({ path: ".env.local" });

console.log("🔍 ตรวจสอบ Firebase Configuration:");
console.log("=====================================");

// ตรวจสอบ environment variables
const requiredEnvVars = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
];

let allConfigured = true;

requiredEnvVars.forEach((varName) => {
  const value = process.env[varName];
  if (value) {
    console.log(`✅ ${varName}: ${value.substring(0, 10)}...`);
  } else {
    console.log(`❌ ${varName}: ไม่พบค่า`);
    allConfigured = false;
  }
});

console.log("\n🔍 ตรวจสอบ Firebase Admin Configuration:");
console.log("=====================================");

if (process.env.FIREBASE_ADMIN_CLIENT_EMAIL) {
  console.log(
    `✅ FIREBASE_ADMIN_CLIENT_EMAIL: ${process.env.FIREBASE_ADMIN_CLIENT_EMAIL}`
  );
} else {
  console.log("❌ FIREBASE_ADMIN_CLIENT_EMAIL: ไม่พบค่า");
  allConfigured = false;
}

if (process.env.FIREBASE_ADMIN_PRIVATE_KEY) {
  console.log("✅ FIREBASE_ADMIN_PRIVATE_KEY: พบค่าแล้ว");
} else {
  console.log("❌ FIREBASE_ADMIN_PRIVATE_KEY: ไม่พบค่า");
  allConfigured = false;
}

console.log("\n=====================================");
if (allConfigured) {
  console.log("✅ Configuration ครบถ้วน!");
} else {
  console.log("❌ Configuration ไม่ครบ กรุณาตรวจสอบไฟล์ .env.local");
}

// ทดสอบ Firebase connection
if (allConfigured) {
  console.log("\n🔍 ทดสอบการเชื่อมต่อ Firebase...");

  const { initializeApp } = require("firebase/app");
  const { getAuth, signInWithEmailAndPassword } = require("firebase/auth");

  const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };

  try {
    const app = initializeApp(firebaseConfig);
    console.log("✅ Firebase initialized successfully!");

    // ทดสอบ Auth
    const auth = getAuth(app);
    console.log("✅ Firebase Auth initialized!");

    // ลอง sign in
    console.log("\n🔍 ทดสอบ Login...");
    signInWithEmailAndPassword(auth, "admin@joolzfactory.com", "MKthailand47")
      .then((userCredential) => {
        console.log("✅ Login สำเร็จ! User:", userCredential.user.email);
        process.exit(0);
      })
      .catch((error) => {
        console.log("❌ Login ล้มเหลว:", error.code, error.message);

        if (error.code === "auth/invalid-credential") {
          console.log("\n💡 วิธีแก้ไข:");
          console.log(
            "1. ตรวจสอบว่า Email/Password authentication เปิดอยู่ใน Firebase Console"
          );
          console.log("2. ตรวจสอบว่า user admin@joolzfactory.com มีอยู่จริง");
          console.log(
            "3. ลองรัน npm run setup:admin เพื่อสร้าง admin user ใหม่"
          );
        }

        process.exit(1);
      });
  } catch (error) {
    console.log("❌ Firebase initialization failed:", error.message);
    process.exit(1);
  }
}
