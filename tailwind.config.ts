import type { Config } from "tailwindcss";

const rgb = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/features/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: rgb("background"),
        surface: {
          1: rgb("surface-1"),
          2: rgb("surface-2"),
          3: rgb("surface-3"),
          hover: rgb("surface-hover"),
          nav: rgb("surface-nav"),
        },
        primary: {
          DEFAULT: rgb("primary"),
          hover: rgb("primary-hover"),
          light: rgb("primary-light"),
          subtle: rgb("primary-subtle"),
        },
        foreground: {
          DEFAULT: rgb("foreground"),
          secondary: rgb("foreground-secondary"),
          muted: rgb("foreground-muted"),
        },
        border: {
          DEFAULT: rgb("border"),
          strong: rgb("border-strong"),
        },
        success: { DEFAULT: rgb("success"), subtle: "rgb(var(--success) / 0.1)" },
        warning: { DEFAULT: rgb("warning"), subtle: "rgb(var(--warning) / 0.1)" },
        danger: { DEFAULT: rgb("danger"), subtle: "rgb(var(--danger) / 0.1)" },
        info: { DEFAULT: rgb("info"), subtle: "rgb(var(--info) / 0.1)" },
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "ui-sans-serif", "system-ui", "-apple-system", "sans-serif"],
        display: ["var(--font-geist-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      fontSize: {
        "2xs": ["11px", { lineHeight: "15px" }],
        // Fluid editorial scale (marketing). Mobile → desktop.
        "display-xl": ["clamp(2.75rem, 1.9rem + 3.6vw, 4.75rem)", { lineHeight: "1.02", letterSpacing: "-0.042em" }],
        "display-lg": ["clamp(2rem, 1.45rem + 2.2vw, 3.25rem)", { lineHeight: "1.06", letterSpacing: "-0.036em" }],
        "display-md": ["clamp(1.625rem, 1.3rem + 1.1vw, 2.125rem)", { lineHeight: "1.15", letterSpacing: "-0.028em" }],
        lede: ["clamp(1.0625rem, 0.98rem + 0.35vw, 1.25rem)", { lineHeight: "1.55", letterSpacing: "-0.011em" }],
      },
      letterSpacing: {
        tightest: "-0.04em",
        architectural: "-0.025em",
      },
      borderRadius: {
        none: "0px",
        sm: "4px",
        DEFAULT: "6px",
        md: "8px",
        lg: "12px",
        xl: "14px",
        "2xl": "20px",
      },
      boxShadow: {
        panel: "0 1px 2px 0 rgb(25 24 29 / 0.04)",
        raised: "0 1px 2px 0 rgb(25 24 29 / 0.04), 0 12px 32px -16px rgb(25 24 29 / 0.14)",
        overlay: "0 0 0 1px rgb(var(--border)), 0 20px 48px -16px rgb(25 24 29 / 0.22)",
      },
      transitionTimingFunction: {
        out: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
      animation: {
        "fade-in": "fadeIn 0.2s cubic-bezier(0.22, 1, 0.36, 1) both",
        "slide-in-right": "slideInRight 0.26s cubic-bezier(0.22, 1, 0.36, 1) both",
        "slide-in-left": "slideInLeft 0.26s cubic-bezier(0.22, 1, 0.36, 1) both",
        "scale-in": "scaleIn 0.2s cubic-bezier(0.22, 1, 0.36, 1) both",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideInRight: {
          "0%": { opacity: "0", transform: "translateX(16px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        slideInLeft: {
          "0%": { opacity: "0", transform: "translateX(-16px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        scaleIn: {
          "0%": { opacity: "0", transform: "scale(0.98)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
