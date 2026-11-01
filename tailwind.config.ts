import type { Config } from "tailwindcss";

const rgb = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/features/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
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
          mineral: "#F4F2EB",
          paper: "#FBFAF6",
        },
        carbon: {
          void: "#0A1012",
          nav: "#0D1417",
          surface: "#131C20",
          border: "#273137",
          text: "#F0F1ED",
          muted: "#91A0A5",
        },
        primary: {
          DEFAULT: rgb("primary"),
          hover: rgb("primary-hover"),
          light: rgb("primary-light"),
          subtle: rgb("primary-subtle"),
          container: "#345BEE",
        },
        foreground: {
          DEFAULT: rgb("foreground"),
          secondary: rgb("foreground-secondary"),
          muted: rgb("foreground-muted"),
        },
        border: {
          DEFAULT: rgb("border"),
          strong: rgb("border-strong"),
          hairline: "#D9DCD7",
        },
        success: {
          DEFAULT: rgb("success"),
          subtle: "rgb(var(--success) / 0.12)",
        },
        warning: {
          DEFAULT: rgb("warning"),
          subtle: "rgb(var(--warning) / 0.12)",
        },
        danger: {
          DEFAULT: rgb("danger"),
          subtle: "rgb(var(--danger) / 0.12)",
        },
        info: {
          DEFAULT: rgb("info"),
          subtle: "rgb(var(--info) / 0.12)",
        },
        signal: {
          blue: "#345BEE",
          mint: "#2DD4BF",
          amber: "#F59E0B",
          red: "#EF4444",
          cyan: "#26A69A",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "-apple-system", "sans-serif"],
        mono: ["var(--font-jetbrains-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
        display: ["var(--font-space-grotesk)", "var(--font-inter)", "sans-serif"],
      },
      fontSize: {
        "2xs": ["11px", { lineHeight: "15px", letterSpacing: "0.04em" }],
        "telemetry-micro": ["11px", { lineHeight: "14px", letterSpacing: "0.02em" }],
        "telemetry-data": ["13px", { lineHeight: "18px", letterSpacing: "-0.01em" }],
        "label-caps": ["11px", { lineHeight: "14px", letterSpacing: "0.08em" }],
      },
      letterSpacing: {
        tightest: "-0.035em",
        architectural: "-0.025em",
      },
      borderRadius: {
        none: "0px",
        sm: "0.125rem",
        DEFAULT: "0.25rem",
        md: "0.25rem",
        lg: "0.375rem",
        xl: "0.5rem",
      },
      boxShadow: {
        panel: "0 0 0 1px rgb(var(--border)), 0 1px 2px 0 rgb(0 0 0 / 0.35)",
        raised: "0 0 0 1px rgb(var(--border-strong)), 0 8px 24px -12px rgb(0 0 0 / 0.6)",
        overlay: "0 0 0 1px rgb(var(--border-strong)), 0 24px 48px -16px rgb(0 0 0 / 0.7)",
      },
      animation: {
        "fade-in": "fadeIn 0.18s cubic-bezier(0.16, 1, 0.3, 1) both",
        "slide-in-right": "slideInRight 0.24s cubic-bezier(0.16, 1, 0.3, 1) both",
        "scale-in": "scaleIn 0.16s cubic-bezier(0.16, 1, 0.3, 1) both",
        "flow-dash": "flowDash 1.6s linear infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0", transform: "translateY(3px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideInRight: {
          "0%": { opacity: "0", transform: "translateX(16px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        scaleIn: {
          "0%": { opacity: "0", transform: "scale(0.98)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        flowDash: {
          "0%": { strokeDashoffset: "16" },
          "100%": { strokeDashoffset: "0" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
