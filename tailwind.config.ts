import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#a3d11b",
          dark: "#8dba16",
          light: "#bcf21d",
          50: "#f6fbe8",
          100: "#eaf6c8",
        },
        hilton: { DEFAULT: "#104c97", dark: "#0a2f5e", light: "#e8f0fa" },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-jakarta)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 40px -10px rgba(163, 209, 27, 0.45)",
        card: "0 10px 30px -5px rgba(15, 23, 42, 0.06), 0 4px 12px -2px rgba(15, 23, 42, 0.03)",
      },
    },
  },
  plugins: [],
};
export default config;
