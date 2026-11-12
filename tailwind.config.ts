import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        hilton: { DEFAULT: "#104c97", dark: "#0a2f5e", light: "#e8f0fa" },
      },
    },
  },
  plugins: [],
};
export default config;
