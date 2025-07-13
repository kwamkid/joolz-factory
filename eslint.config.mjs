// eslint.config.mjs
import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // ปิด warnings ที่น่ารำคาญ
      "@typescript-eslint/no-unused-vars": "off",
      "react-hooks/exhaustive-deps": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/ban-ts-comment": "off",

      // ปรับ React warnings
      "react/no-unescaped-entities": "off",
      "react/display-name": "off",
      "react/jsx-key": "warn", // เปลี่ยนจาก error เป็น warn

      // ปรับ Next.js warnings
      "@next/next/no-img-element": "off",
      "@next/next/no-html-link-for-pages": "off",

      // General JavaScript
      "no-console": "off", // อนุญาตให้ใช้ console.log
      "no-debugger": "warn", // แค่ warn สำหรับ debugger
      "no-unused-vars": "off", // ปิดสำหรับ JS
      "prefer-const": "warn",
      "no-var": "warn",

      // Import/Export
      "import/no-anonymous-default-export": "off",
      "import/prefer-default-export": "off",

      // Allow any naming convention
      "@typescript-eslint/naming-convention": "off",

      // TypeScript specific - เผื่อโปรเจ็คใหญ่ขึ้น
      "@typescript-eslint/no-non-null-assertion": "warn",
      "@typescript-eslint/prefer-optional-chain": "warn",
    },

    // กำหนดไฟล์ที่จะไม่ check
    ignorePatterns: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "dist/**",
      "public/**",
      "*.config.js",
      "*.config.ts",
      "*.config.mjs",
    ],
  },
  {
    // สำหรับไฟล์ config - ปิด rules เกือบหมด
    files: [
      "*.config.js",
      "*.config.ts",
      "*.config.mjs",
      "next.config.js",
      "tailwind.config.js",
    ],
    rules: {
      "@typescript-eslint/no-var-requires": "off",
      "@typescript-eslint/no-require-imports": "off",
      "import/no-anonymous-default-export": "off",
    },
  },
  {
    // สำหรับ development files
    files: [
      "**/*.test.{js,ts,tsx}",
      "**/*.spec.{js,ts,tsx}",
      "**/__tests__/**",
    ],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
    },
  },
];

export default eslintConfig;
