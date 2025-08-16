// scripts/setup-admin.js
const { initializeApp } = require("firebase/app");
const { getAuth, createUserWithEmailAndPassword } = require("firebase/auth");
const { getFirestore, doc, setDoc } = require("firebase/firestore");
require("dotenv").config({ path: ".env.local" });

// Firebase config from environment
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Admin credentials
const ADMIN_EMAIL = "admin@joolzfactory.com";
const ADMIN_PASSWORD = "JoolzAdmin2024!";
const ADMIN_NAME = "System Administrator";

async function setupAdmin() {
  try {
    console.log("🔧 Creating admin account...");
    console.log("");

    // Create auth account
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      ADMIN_EMAIL,
      ADMIN_PASSWORD
    );

    console.log("✅ Admin auth account created:", userCredential.user.uid);

    // Create user document in Firestore
    await setDoc(doc(db, "users", userCredential.user.uid), {
      email: ADMIN_EMAIL,
      name: ADMIN_NAME,
      role: "admin",
      createdAt: new Date(),
    });

    console.log("✅ Admin user document created in Firestore");
    console.log("");
    console.log("========================================");
    console.log("✅ Admin account setup complete!");
    console.log("========================================");
    console.log("");
    console.log("📧 Login credentials:");
    console.log(`   Email: ${ADMIN_EMAIL}`);
    console.log(`   Password: ${ADMIN_PASSWORD}`);
    console.log("");
    console.log("⚠️  Please change the password after first login!");
    console.log("");
  } catch (error) {
    if (error.code === "auth/email-already-in-use") {
      console.log("");
      console.log("ℹ️  Admin account already exists");
      console.log(`   Email: ${ADMIN_EMAIL}`);
      console.log("");
    } else {
      console.error("❌ Error creating admin:", error.message);
      console.error("   Error code:", error.code);
    }
  }

  process.exit(0);
}

// Check Firebase config
console.log("🔍 Checking Firebase configuration...");
console.log("");

if (!firebaseConfig.apiKey) {
  console.error("❌ Firebase configuration not found!");
  console.error(
    "   Please make sure .env.local file exists with Firebase config"
  );
  process.exit(1);
}

console.log("✅ Firebase configuration found");
console.log("");

// Run setup
setupAdmin();
