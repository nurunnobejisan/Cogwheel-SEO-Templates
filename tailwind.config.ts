import type { Config } from "tailwindcss";

/**
 * Cogwheel design tokens.
 *
 * The UI deliberately stays on Tailwind's `slate` neutral ramp (every component
 * already ships `dark:` slate variants) and layers a small, semantic token set
 * on top: a proper brand ramp (the old config only defined 50/100, so the
 * widely-used `brand-950` classes rendered nothing), a readability-first type
 * scale, and a calmer shadow system.
 */
const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#a3d11b",
          dark: "#82ab12",
          light: "#bcf21d",
          50: "#f7fce8",
          100: "#eef8cc",
          200: "#ddf1a3",
          300: "#c8e86f",
          400: "#b3dd3f",
          500: "#a3d11b",
          600: "#82ab12",
          700: "#628210",
          800: "#4d6614",
          900: "#415616",
          950: "#1f2e08",
        },
        hilton: {
          DEFAULT: "#104c97",
          dark: "#0a2f5e",
          light: "#e8f0fa",
          950: "#08203f",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-jakarta)", "system-ui", "sans-serif"],
      },
      /**
       * Semantic type scale. Additive on purpose: existing `text-xs/sm/base`
       * utilities keep working, while new work uses these named steps so the
       * hierarchy is consistent instead of a scatter of `text-[10px]`/`[11px]`.
       */
      fontSize: {
        micro: ["0.625rem", { lineHeight: "0.875rem" }],
        tiny: ["0.6875rem", { lineHeight: "1rem" }],
        eyebrow: ["0.6875rem", { lineHeight: "1rem", letterSpacing: "0.08em" }],
        caption: ["0.75rem", { lineHeight: "1.0625rem" }],
        body: ["0.875rem", { lineHeight: "1.375rem" }],
        h3: ["0.9375rem", { lineHeight: "1.375rem" }],
        h2: ["1.0625rem", { lineHeight: "1.5rem" }],
        title: ["1.375rem", { lineHeight: "1.75rem", letterSpacing: "-0.02em" }],
        display: ["1.875rem", { lineHeight: "2.25rem", letterSpacing: "-0.025em" }],
      },
      boxShadow: {
        xs: "0 1px 2px rgba(15, 23, 42, 0.05)",
        soft: "0 1px 2px rgba(15, 23, 42, 0.04), 0 6px 20px -8px rgba(15, 23, 42, 0.10)",
        card: "0 1px 3px rgba(15, 23, 42, 0.04), 0 12px 32px -14px rgba(15, 23, 42, 0.14)",
        floating: "0 24px 48px -18px rgba(15, 23, 42, 0.26)",
        glow: "0 0 40px -10px rgba(163, 209, 27, 0.45)",
      },
      transitionTimingFunction: {
        "out-expo": "cubic-bezier(0.16, 1, 0.3, 1)",
      },
      /** `4.5`/`7.5`/`8.5` were used before these tokens existed and silently rendered nothing. */
      spacing: {
        "4.5": "1.125rem",
        "7.5": "1.875rem",
        "8.5": "2.125rem",
      },
      keyframes: {
        fadeInSlide: {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-in": "fadeInSlide 0.22s cubic-bezier(0.16, 1, 0.3, 1) both",
      },
    },
  },
  plugins: [],
};

export default config;
