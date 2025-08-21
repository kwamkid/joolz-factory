// Path: tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Primary - Orange
        primary: {
          DEFAULT: "#E9B308",
          dark: "#CA9A00",
          light: "#FCC70A",
          50: "#FFFBEB",
          100: "#FEF3C7",
          200: "#FDE68A",
          300: "#FCD34D",
          400: "#FBBF24",
          500: "#E9B308",
          600: "#CA9A00",
          700: "#A87800",
          800: "#855600",
          900: "#633500",
        },
        // Secondary - Dark Green
        secondary: {
          DEFAULT: "#00231F",
          dark: "#001915",
          light: "#003A33",
          50: "#E6F4F1",
          100: "#CCE9E3",
          200: "#99D3C7",
          300: "#66BCAB",
          400: "#33A68F",
          500: "#009073",
          600: "#007A57",
          700: "#00643B",
          800: "#004E1F",
          900: "#00231F",
        },
        // Override gray with custom scale
        gray: {
          50: "#F9FAFB",
          100: "#F3F4F6",
          200: "#E5E7EB",
          300: "#D1D5DB",
          400: "#9CA3AF",
          500: "#6B7280",
          600: "#4B5563",
          700: "#374151",
          800: "#1F2937",
          900: "#111827",
        },
      },
      fontFamily: {
        sans: [
          "IBM Plex Sans Thai",
          "system-ui",
          "-apple-system",
          "sans-serif",
        ],
      },
      fontSize: {
        // ปรับขนาด font ให้อ่านง่ายแต่ไม่ใหญ่เกินไป
        xs: ["0.75rem", { lineHeight: "1rem" }], // 12px
        sm: ["0.875rem", { lineHeight: "1.25rem" }], // 14px
        base: ["1rem", { lineHeight: "1.5rem" }], // 16px
        lg: ["1.125rem", { lineHeight: "1.75rem" }], // 18px
        xl: ["1.25rem", { lineHeight: "1.75rem" }], // 20px
        "2xl": ["1.5rem", { lineHeight: "2rem" }], // 24px
        "3xl": ["1.875rem", { lineHeight: "2.25rem" }], // 30px
        "4xl": ["2.25rem", { lineHeight: "2.5rem" }], // 36px
        "5xl": ["3rem", { lineHeight: "1" }], // 48px
      },
      screens: {
        xs: "475px",
        sm: "640px",
        md: "768px",
        lg: "1024px",
        xl: "1280px",
        "2xl": "1536px",
      },
      spacing: {
        18: "4.5rem",
        88: "22rem",
        120: "30rem",
      },
      animation: {
        "slide-in-left": "slideInLeft 0.3s ease-out",
        "slide-in-right": "slideInRight 0.3s ease-out",
        "fade-in": "fadeIn 0.3s ease-out",
        "spin-slow": "spin 3s linear infinite",
      },
      backdropBlur: {
        xs: "2px",
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.5rem",
      },
      boxShadow: {
        glow: "0 0 20px rgba(233, 179, 8, 0.3)",
        "glow-lg": "0 0 30px rgba(233, 179, 8, 0.4)",
      },
      minHeight: {
        touch: "44px",
        button: "48px",
        "button-lg": "56px",
      },
    },
  },
  plugins: [],
};
