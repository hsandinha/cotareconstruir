import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        inter: ["var(--font-inter)"],
      },
      boxShadow: {
        "glass": "0 20px 45px rgba(37, 99, 235, 0.18)",
        "glow": "0 30px 80px rgba(59, 130, 246, 0.35)",
      },
      backgroundImage: {
        "hero-gradient": "linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)",
      },
      keyframes: {
        "float-slow": {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-12px)" },
        },
        "fade-in-up": {
          "0%": { opacity: "0", transform: "translateY(24px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
        pulse3d: {
          "0%, 100%": { transform: "scale3d(1, 1, 1)" },
          "50%": { transform: "scale3d(1.05, 1.05, 1.05)" },
        },
      },
      animation: {
        "float-slow": "float-slow 6s ease-in-out infinite",
        "fade-in-up": "fade-in-up 0.8s ease forwards",
        shimmering: "shimmer 2.4s linear infinite",
        pulse3d: "pulse3d 4.5s ease-in-out infinite",
      },
      perspective: {
        xl: "1600px",
      },
      transformOrigin: {
        "center-top": "center top",
      },
    },
  },
  plugins: [],
};

export default config;
