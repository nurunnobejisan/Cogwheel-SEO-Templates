import type { Config } from "tailwindcss";

/**
 * SEO & GEO Studio design token mapping.
 *
 * All core surface, text, border, brand, and status tokens resolve through
 * CSS custom properties in `src/app/globals.css` (`:root` and `.dark`) so
 * components avoid hardcoded hex colors and `dark:` utility duplication.
 */
const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "rgb(var(--canvas) / <alpha-value>)",
        surface: "rgb(var(--surface) / <alpha-value>)",
        "surface-2": "rgb(var(--surface-2) / <alpha-value>)",
        border: "rgb(var(--border) / <alpha-value>)",
        "border-strong": "rgb(var(--border-strong) / <alpha-value>)",
        text: "rgb(var(--text) / <alpha-value>)",
        "text-muted": "rgb(var(--text-muted) / <alpha-value>)",
        "text-subtle": "rgb(var(--text-subtle) / <alpha-value>)",
        sidebar: "rgb(var(--sidebar) / <alpha-value>)",
        "sidebar-text": "rgb(var(--sidebar-text) / <alpha-value>)",
        "sidebar-active": "rgb(var(--sidebar-active) / <alpha-value>)",
        brand: {
          DEFAULT: "rgb(var(--brand) / <alpha-value>)",
          fg: "rgb(var(--brand-fg) / <alpha-value>)",
          soft: "var(--brand-soft)",
          // Legacy ramp kept temporarily for unmigrated components until Phase 4
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
        link: "rgb(var(--link) / <alpha-value>)",
        error: {
          DEFAULT: "rgb(var(--error) / <alpha-value>)",
          soft: "var(--error-soft)",
          fg: "rgb(var(--error-fg) / <alpha-value>)",
        },
        warning: {
          DEFAULT: "rgb(var(--warning) / <alpha-value>)",
          soft: "var(--warning-soft)",
          fg: "rgb(var(--warning-fg) / <alpha-value>)",
        },
        notice: {
          DEFAULT: "rgb(var(--notice) / <alpha-value>)",
          soft: "var(--notice-soft)",
          fg: "rgb(var(--notice-fg) / <alpha-value>)",
        },
        success: {
          DEFAULT: "rgb(var(--success) / <alpha-value>)",
          soft: "var(--success-soft)",
          fg: "rgb(var(--success-fg) / <alpha-value>)",
        },
        // Legacy alias kept temporarily for unmigrated components until Phase 4
        hilton: {
          DEFAULT: "#104c97",
          dark: "#0a2f5e",
          light: "#e8f0fa",
          950: "#08203f",
        },
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "-apple-system", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
        display: ["var(--font-geist-sans)", "system-ui", "-apple-system", "sans-serif"],
      },
      fontSize: {
        display: [
          "clamp(1.75rem, 1.2rem + 1.6vw, 2.25rem)",
          { lineHeight: "1.15", letterSpacing: "-0.025em", fontWeight: "600" },
        ],
        title: [
          "clamp(1.25rem, 1.05rem + 0.6vw, 1.5rem)",
          { lineHeight: "1.25", letterSpacing: "-0.02em", fontWeight: "600" },
        ],
        heading: ["1rem", { lineHeight: "1.4", letterSpacing: "-0.01em", fontWeight: "600" }],
        body: ["0.875rem", { lineHeight: "1.5", letterSpacing: "0", fontWeight: "400" }],
        table: ["0.8125rem", { lineHeight: "1.4", letterSpacing: "0", fontWeight: "400" }],
        caption: ["0.75rem", { lineHeight: "1.35", letterSpacing: "0", fontWeight: "500" }],
        overline: ["0.6875rem", { lineHeight: "1.3", letterSpacing: "0.06em", fontWeight: "600" }],
        // Legacy aliases kept temporarily for unmigrated components until Phase 4
        micro: ["0.75rem", { lineHeight: "1.35" }],
        tiny: ["0.75rem", { lineHeight: "1.35" }],
        eyebrow: ["0.6875rem", { lineHeight: "1.3", letterSpacing: "0.06em" }],
        h3: ["0.9375rem", { lineHeight: "1.35" }],
        h2: ["1rem", { lineHeight: "1.4" }],
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        DEFAULT: "var(--radius)",
        md: "var(--radius)",
        lg: "var(--radius-lg)",
        xl: "var(--radius)",
        full: "9999px",
      },
      boxShadow: {
        none: "none",
        pop: "var(--shadow-pop)",
        overlay: "var(--shadow-overlay)",
        specular: "var(--shadow-specular)",
        // Legacy aliases mapped flat until Phase 4
        xs: "none",
        soft: "var(--shadow-specular)",
        card: "var(--shadow-specular)",
        floating: "var(--shadow-overlay)",
        glow: "var(--shadow-pop)",
      },
      transitionTimingFunction: {
        telemetry: "cubic-bezier(0.2, 0.8, 0.2, 1)",
        "out-expo": "cubic-bezier(0.2, 0.8, 0.2, 1)",
      },
      transitionDuration: {
        fast: "150ms",
        panel: "220ms",
      },
      keyframes: {
        fadeInSlide: {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        shimmerSlide: {
          "0%": { backgroundPosition: "200% 0" },
          "100%": { backgroundPosition: "-200% 0" },
        },
      },
      animation: {
        "fade-in": "fadeInSlide 220ms cubic-bezier(0.2, 0.8, 0.2, 1) both",
        shimmer: "shimmerSlide 1.2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
